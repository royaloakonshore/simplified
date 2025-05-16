"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export type NavMainItemType = {
  title: string
  url: string
  icon?: LucideIcon
  // isActive is determined dynamically using pathname
  items?: {
    title: string
    url: string
    // isActive is determined dynamically using pathname
  }[]
}

export function NavMain({ items }: { items: NavMainItemType[] }) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // Determine if the parent item itself is active or if any sub-item is active
          const isParentLinkActive = item.url === pathname; // Exact match for parent link
          const isAnySubItemActive = item.items?.some(subItem => pathname.startsWith(subItem.url)) ?? false;
          // A section is considered active if its direct link is active or any of its children are active.
          const isSectionActive = item.items?.length ? (pathname.startsWith(item.url) && isAnySubItemActive) : isParentLinkActive;
          // Default open if the section is active OR if a sub-item is the *exact* current path
          const defaultOpenCollapsible = item.items?.length ? (pathname.startsWith(item.url)) : false;

          const hasSubItems = item.items && item.items.length > 0

          if (hasSubItems) {
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={defaultOpenCollapsible} 
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    {/* The button itself is active if its direct URL matches and it's meant to be a link, OR if a sub-item is active making the section current */}
                    <SidebarMenuButton tooltip={item.title} isActive={isParentLinkActive && !isAnySubItemActive}> 
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubItemActive = pathname.startsWith(subItem.url);
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          } else {
            // Item without sub-items: Render as a direct link
            const isActive = item.url === pathname || (item.url !== "/" && pathname.startsWith(item.url));
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
