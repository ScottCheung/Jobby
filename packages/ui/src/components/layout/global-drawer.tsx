"use client"

import { useLayoutStore } from "@/lib/store/layout-store"
import { Drawer } from "./drawer"

export function GlobalDrawer() {
    const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen)
    const drawerConfig = useLayoutStore((state) => state.drawerConfig)
    const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer)

    return (
        <Drawer
            isOpen={isDrawerOpen}
            onClose={closeDrawer}
            width={drawerConfig.width}
        >
            {drawerConfig.content}
        </Drawer>
    )
}
