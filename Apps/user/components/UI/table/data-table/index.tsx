import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
    ColumnOrderState,
    Table as ReactTable,
    OnChangeFn,
} from "@tanstack/react-table"
import { ArrowUpDown, ArrowUp, ArrowDown, Settings2, GripVertical } from "lucide-react"

import { Button } from "@/components/UI/Button"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    enableSorting?: boolean
    enableColumnVisibility?: boolean
    enableRowSelection?: boolean
    onRowSelectionChange?: (selectedRows: TData[]) => void
    enableTextTruncationToggle?: boolean
    isTextExpanded?: boolean
    onTextExpandedChange?: (expanded: boolean) => void
    isSettingsOpen?: boolean
    onSettingsOpenChange?: (open: boolean) => void
    defaultSorting?: SortingState
    renderRowActions?: (row: any) => React.ReactNode
    hideToolbar?: boolean
    isSelectionMode?: boolean
    onSelectionModeChange?: (mode: boolean) => void
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
    columnVisibility?: VisibilityState
    onColumnVisibilityChange?: OnChangeFn<VisibilityState>
    columnOrder?: ColumnOrderState
    onColumnOrderChange?: OnChangeFn<ColumnOrderState>
}

export function DataTable<TData, TValue>({
    columns,
    data,
    enableSorting = true,
    enableColumnVisibility = true,
    enableRowSelection = false,
    onRowSelectionChange,
    enableTextTruncationToggle = false,
    isTextExpanded,
    onTextExpandedChange,
    isSettingsOpen,
    onSettingsOpenChange,
    defaultSorting = [],
    renderRowActions,
    hideToolbar = false,
    isSelectionMode,
    onSelectionModeChange,
    sorting: controlledSorting,
    onSortingChange,
    columnVisibility: controlledColumnVisibility,
    onColumnVisibilityChange,
    columnOrder: controlledColumnOrder,
    onColumnOrderChange,
}: DataTableProps<TData, TValue>) {
    const [internalSorting, setInternalSorting] = React.useState<SortingState>(defaultSorting)
    const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})
    const [internalSelectionMode, setInternalSelectionMode] = React.useState(false)
    const [internalColumnOrder, setInternalColumnOrder] = React.useState<ColumnOrderState>(
        columns.map((column) => column.id as string || (column as any).accessorKey as string)
    )

    // Use controlled or uncontrolled state
    const selectionMode = isSelectionMode ?? internalSelectionMode
    const setSelectionMode = onSelectionModeChange || setInternalSelectionMode

    // Settings open state is only for triggering the callback, dialog is external
    const setIsSettingsDialogOpen = onSettingsOpenChange || (() => { })

    const finalSorting = controlledSorting ?? internalSorting
    const setFinalSorting = onSortingChange ?? setInternalSorting

    const finalColumnVisibility = React.useMemo(() => ({
        ...(controlledColumnVisibility ?? internalColumnVisibility),
        select: !!selectionMode
    }), [controlledColumnVisibility, internalColumnVisibility, selectionMode])
    const setFinalColumnVisibility = onColumnVisibilityChange ?? setInternalColumnVisibility

    const finalColumnOrder = controlledColumnOrder ?? internalColumnOrder
    const setFinalColumnOrder = onColumnOrderChange ?? setInternalColumnOrder

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting: finalSorting,
            columnVisibility: finalColumnVisibility,
            columnOrder: finalColumnOrder,
            rowSelection,
        },
        enableRowSelection: enableRowSelection,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setFinalSorting,
        onColumnVisibilityChange: setFinalColumnVisibility,
        onColumnOrderChange: setFinalColumnOrder,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    // Notify parent of selection changes
    React.useEffect(() => {
        if (enableRowSelection && onRowSelectionChange) {
            const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
            onRowSelectionChange(selectedRows)
        }
    }, [rowSelection, enableRowSelection, onRowSelectionChange, table])

    // Toggle selection column visibility
    React.useEffect(() => {
        if (!selectionMode) {
            setRowSelection({})
        }
    }, [selectionMode])

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            {enableColumnVisibility && !hideToolbar && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {enableRowSelection && (
                            <>
                                <Button
                                    variant={selectionMode ? "secondary" : "outline"}
                                    size="sm"
                                    className="rounded-full cursor-pointer"
                                    onClick={() => setSelectionMode(!selectionMode)}
                                >
                                    <GripVertical className="mr-2 size-4" />
                                    {selectionMode ? "Exit Selection" : "Select Rows"}
                                </Button>
                                {selectionMode && (
                                    <div className="text-sm text-ink-secondary animate-in fade-in slide-in-from-left-2">
                                        {table.getFilteredSelectedRowModel().rows.length} selected
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setIsSettingsDialogOpen(true)}
                    >
                        <Settings2 className="mr-2 size-4" />
                        Table Settings
                    </Button>
                </div>
            )}

            {/* Settings Dialog - Now External, triggered via onSettingsOpenChange */}

            {/* Table */}
            <div className={cn("overflow-hidden rounded-md border border-gray-200 dark:border-zinc-800")}>
                <div className="overflow-x-auto max-h-[600px] relative">
                    <table className="w-full text-left text-sm relative caption-bottom">
                        <thead className="bg-background text-ink-primary sticky top-0 z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className=" font-medium"
                                            style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={cn(
                                                        "flex justify-center items-center gap-2 px-4 py-2",
                                                        header.column.getCanSort() && "cursor-pointer select-none"
                                                    )}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {enableSorting && header.column.getCanSort() && (
                                                        <span className="flex">
                                                            {header.column.getIsSorted() === "asc" ? (
                                                                <ArrowUp className="size-4 text-primary" />
                                                            ) : header.column.getIsSorted() === "desc" ? (
                                                                <ArrowDown className="size-4 text-primary" />
                                                            ) : (
                                                                <ArrowUpDown className="size-4 opacity-50" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-panel ">
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="group relative hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id} className="px-4 py-2 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                        {renderRowActions && (
                                            <td className="absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                                                <div className="flex items-center gap-2 px-4 py-2 bg-panel  shadow-sm border border-gray-200 dark:border-zinc-700 rounded-full p-2">
                                                    {renderRowActions(row)}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={columns.length}
                                        className="px-6 py-8 text-center text-ink-secondary"
                                    >
                                        No results found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
