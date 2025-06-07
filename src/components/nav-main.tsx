"use client"

import Link from 'next/link'
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

export interface SubNavItemProcessed {
  title: string
  url: string
  isActive?: boolean
}

export interface NavItemProcessed {
  title: string
  url: string
  icon?: LucideIcon
  items?: SubNavItemProcessed[]
  isCollapsible?: boolean
  isActive?: boolean
}

interface NavMainProps {
  items: NavItemProcessed[];
}

export function NavMain({ items }: NavMainProps) {
  const { open: isSidebarOpen, isMobile } = useSidebar()
  const tooltipsActive = !isMobile && !isSidebarOpen

  return (
    <SidebarMenu className="p-2">
      {items.map((item) => (
        <Collapsible key={item.title} asChild defaultOpen={item.isActive && item.items && item.items.length > 0}>
          <SidebarMenuItem className="group/menu-item">
            <div className={cn("flex items-center", tooltipsActive && "justify-center")}>
              <SidebarMenuButton
                asChild
                tooltip={tooltipsActive ? item.title : undefined}
                isActive={item.isActive}
                className={cn(tooltipsActive && "px-0 w-8 justify-center")}
              >
                <Link href={item.url} className="flex items-center w-full">
                  {item.icon && <item.icon className={cn("h-4 w-4", tooltipsActive ? "mx-auto" : "mr-2")} />}
                  {!tooltipsActive && <span className="truncate">{item.title}</span>}
                </Link>
              </SidebarMenuButton>
              {item.isCollapsible && item.items && item.items.length > 0 && !tooltipsActive && (
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="data-[state=open]:rotate-90 ml-auto group-hover/menu-item:opacity-100 md:opacity-0 focus:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Toggle {item.title}</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
              )}
            </div>
            {item.isCollapsible && item.items && item.items.length > 0 && (
              <CollapsibleContent>
                <SidebarMenuSub className={cn(tooltipsActive && "hidden")}>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={subItem.isActive}>
                        <Link href={subItem.url}>
                          <span className="truncate">{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            )}
          </SidebarMenuItem>
        </Collapsible>
      ))}
    </SidebarMenu>
  )
}
