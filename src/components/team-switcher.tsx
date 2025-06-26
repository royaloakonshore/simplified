"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2 as DefaultCompanyIcon } from "lucide-react"
import { useSession } from "next-auth/react"
import { api as trpc } from "@/lib/trpc/react"
import { toast } from "react-toastify"
import { z } from "zod"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { UserRole } from "@/lib/auth"
import { cn } from "@/lib/utils"

const createCompanyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
})
type CreateCompanyFormValues = z.infer<typeof createCompanyFormSchema>

export function TeamSwitcher() {
  const { data: session, update: updateSession } = useSession()
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const trpcUtils = trpc.useUtils()
  const [isCreateCompanyDialogOpen, setCreateCompanyDialogOpen] = React.useState(false)

  const {
    data: memberCompanies,
    isLoading: isLoadingCompanies,
    error: companiesError,
  } = trpc.user.getMemberCompanies.useQuery(undefined, {
    enabled: !!session,
  })

  const setActiveCompanyMutation = trpc.user.setActiveCompany.useMutation({
    onSuccess: async (data) => {
      if (data.success && data.activeCompanyId) {
        toast.success("Active company switched!")
        await updateSession()
        trpcUtils.user.getMemberCompanies.invalidate()
      } else {
        toast.error("Failed to switch company. Please try again.")
      }
    },
    onError: (error) => {
      toast.error(`Error switching company: ${error.message}`)
    },
  })

  const createCompanyMutation = trpc.company.create.useMutation({
    onSuccess: async (newCompany) => {
      toast.success(`Company "${newCompany.name}" created successfully!`)
      setCreateCompanyDialogOpen(false)
      await updateSession()
      trpcUtils.user.getMemberCompanies.invalidate()
    },
    onError: (error) => {
      toast.error(`Error creating company: ${error.message}`)
    },
  })

  const createCompanyForm = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanyFormSchema),
    defaultValues: { name: "" },
  })

  const onCreateCompanySubmit: SubmitHandler<CreateCompanyFormValues> = (values) => {
    createCompanyMutation.mutate(values)
  }

  const currentActiveCompanyId = session?.user?.activeCompanyId

  const activeCompanyDetails = React.useMemo(() => {
    if (!memberCompanies || !currentActiveCompanyId) return null
    return memberCompanies.find(c => c.id === currentActiveCompanyId)
  }, [memberCompanies, currentActiveCompanyId])

  const handleTeamSelect = (companyId: string) => {
    if (companyId === currentActiveCompanyId || setActiveCompanyMutation.isPending) return
    setActiveCompanyMutation.mutate({ companyId })
  }

  if (isLoadingCompanies) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled className={cn(
            "w-full",
            isCollapsed ? "justify-center p-0" : "justify-start"
          )}>
            <div className={cn(
              "flex aspect-square items-center justify-center rounded-lg bg-muted animate-pulse",
              isCollapsed ? "size-8" : "size-8"
            )} />
            {!isCollapsed && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="h-4 w-20 bg-muted rounded animate-pulse"></span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (companiesError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="justify-start text-destructive">
            Error loading companies
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const companyToDisplay = activeCompanyDetails || (memberCompanies && memberCompanies.length > 0 ? memberCompanies[0] : null)
  const canCreateCompany = session?.user?.role === UserRole.admin

  const addCompanyButton = (
    <DropdownMenuItem 
      className="gap-2 p-2" 
      onSelect={() => setCreateCompanyDialogOpen(true)}
      disabled={!canCreateCompany || createCompanyMutation.isPending}
    >
      <div className="flex size-6 items-center justify-center rounded-md border bg-background">
        <Plus className="size-4" />
      </div>
      <div className="font-medium text-muted-foreground">Add Company</div>
      {!canCreateCompany && <DropdownMenuShortcut>Admin only</DropdownMenuShortcut>}
    </DropdownMenuItem>
  )

  if (!companyToDisplay) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(
                "w-full",
                isCollapsed ? "justify-center p-0" : "justify-start"
              )}>
                <div className={cn(
                  "flex aspect-square items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground",
                  isCollapsed ? "size-8" : "size-8"
                )}>
                  <Plus className="size-4" />
                </div>
                {!isCollapsed && (
                  <>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">No Company</span>
                      <span className="truncate text-xs text-muted-foreground">Select or Add</span>
                    </div>
                    <ChevronsUpDown className="ml-auto text-muted-foreground" />
                  </>
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              {addCompanyButton}
            </DropdownMenuContent>
          </DropdownMenu>
          <CreateCompanyDialog 
            isOpen={isCreateCompanyDialogOpen} 
            onOpenChange={setCreateCompanyDialogOpen} 
            form={createCompanyForm} 
            onSubmit={onCreateCompanySubmit} 
            isLoading={createCompanyMutation.isPending}
          />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={cn(
                "w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                isCollapsed ? "justify-center p-0" : "justify-start"
              )}
              disabled={setActiveCompanyMutation.isPending}
            >
              <div className={cn(
                "flex aspect-square items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground",
                isCollapsed ? "size-8" : "size-8"
              )}>
                <DefaultCompanyIcon className="size-4" />
              </div>
              {!isCollapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {companyToDisplay.name}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto text-muted-foreground" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch Company
            </DropdownMenuLabel>
            {(memberCompanies || []).map((company) => (
              <DropdownMenuItem
                key={company.id}
                onSelect={() => handleTeamSelect(company.id)}
                className="gap-2 p-2"
                disabled={setActiveCompanyMutation.isPending || company.id === currentActiveCompanyId}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <DefaultCompanyIcon className="size-4 shrink-0" />
                </div>
                <span className="flex-1 truncate">{company.name}</span>
                {company.id === currentActiveCompanyId && <DropdownMenuShortcut>Active</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {addCompanyButton}
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateCompanyDialog 
          isOpen={isCreateCompanyDialogOpen} 
          onOpenChange={setCreateCompanyDialogOpen} 
          form={createCompanyForm} 
          onSubmit={onCreateCompanySubmit} 
          isLoading={createCompanyMutation.isPending}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

interface CreateCompanyDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  form: ReturnType<typeof useForm<CreateCompanyFormValues>>
  onSubmit: SubmitHandler<CreateCompanyFormValues>
  isLoading: boolean
}

function CreateCompanyDialog({ isOpen, onOpenChange, form, onSubmit, isLoading }: CreateCompanyDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Enter the name for the new company. You will be automatically added as a member and it will become your active company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Company Name
              </Label>
              <Input 
                id="name" 
                {...form.register("name")} 
                className="col-span-3" 
                disabled={isLoading}
              />
            </div>
            {form.formState.errors.name && (
              <p className="col-span-4 text-sm text-destructive text-right">{form.formState.errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
