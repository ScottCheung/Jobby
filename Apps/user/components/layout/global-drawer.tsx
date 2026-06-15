"use client"

import { useLayoutStore } from "@/lib/store/layout-store"
import { Drawer } from "@/components/layout/drawer"

export function GlobalDrawer() {
    const { isDrawerOpen, drawerConfig, actions } = useLayoutStore()

    return (
        <Drawer
            isOpen={isDrawerOpen}
            onClose={actions.closeDrawer}
            width={drawerConfig.width}
        >
            {drawerConfig.content}
        </Drawer>
    )
}
