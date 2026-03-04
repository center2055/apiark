import { useState } from "react";
import type { CollectionNode, HttpMethod } from "@apiark/types";
import { useCollectionStore } from "@/stores/collection-store";
import { useTabStore } from "@/stores/tab-store";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
  Download,
} from "lucide-react";
import { exportCollectionToFile } from "@/lib/export-collection";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-green-500",
  POST: "text-yellow-500",
  PUT: "text-blue-500",
  PATCH: "text-purple-500",
  DELETE: "text-red-500",
  HEAD: "text-cyan-500",
  OPTIONS: "text-gray-500",
};

interface CollectionTreeProps {
  nodes: CollectionNode[];
  collectionPath: string;
  collectionName: string;
  depth?: number;
}

export function CollectionTree({
  nodes,
  collectionPath,
  collectionName,
  depth = 0,
}: CollectionTreeProps) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          collectionPath={collectionPath}
          collectionName={collectionName}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  collectionPath,
  collectionName,
  depth,
}: {
  node: CollectionNode;
  collectionPath: string;
  collectionName: string;
  depth: number;
}) {
  const { expandedPaths, toggleExpand, createRequest, createFolder, deleteItem, renameItem } =
    useCollectionStore();
  const { openTab } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const isExpanded = expandedPaths.has(node.path);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewRequest = async () => {
    closeContextMenu();
    const dir = node.type === "request" ? collectionPath : node.path;
    const name = prompt("Request name:");
    if (!name) return;
    const filename = name.toLowerCase().replace(/\s+/g, "-");
    try {
      const path = await createRequest(dir, filename, name, collectionPath);
      await openTab(path, collectionPath);
    } catch (err) {
      console.error("Failed to create request:", err);
    }
  };

  const handleNewFolder = async () => {
    closeContextMenu();
    const dir = node.type === "request" ? collectionPath : node.path;
    const name = prompt("Folder name:");
    if (!name) return;
    try {
      await createFolder(dir, name);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const handleDelete = async () => {
    closeContextMenu();
    if (!confirm(`Delete "${node.name}"?`)) return;
    try {
      await deleteItem(node.path, collectionName, collectionPath);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleRename = () => {
    closeContextMenu();
    setRenameValue(node.name);
    setRenaming(true);
  };

  const submitRename = async () => {
    setRenaming(false);
    if (!renameValue.trim() || renameValue === node.name) return;
    try {
      await renameItem(node.path, renameValue.trim(), collectionPath);
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  };

  if (node.type === "request") {
    return (
      <>
        <button
          onClick={() => openTab(node.path, collectionPath)}
          onContextMenu={handleContextMenu}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-[var(--color-elevated)]"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className={`w-9 shrink-0 text-[10px] font-bold ${METHOD_COLORS[node.method]}`}>
            {node.method}
          </span>
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="flex-1 rounded bg-[var(--color-elevated)] px-1 text-sm text-[var(--color-text-primary)] outline-none ring-1 ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-[var(--color-text-secondary)]">{node.name}</span>
          )}
        </button>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            items={[
              { label: "Rename", icon: Pencil, onClick: handleRename },
              { label: "Delete", icon: Trash2, onClick: handleDelete, danger: true },
            ]}
          />
        )}
      </>
    );
  }

  // Folder or Collection
  const children = node.children;

  return (
    <>
      <button
        onClick={() => toggleExpand(node.path)}
        onContextMenu={handleContextMenu}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-[var(--color-elevated)]"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        )}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="flex-1 rounded bg-[var(--color-elevated)] px-1 text-sm text-[var(--color-text-primary)] outline-none ring-1 ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate text-[var(--color-text-primary)]">{node.name}</span>
        )}
      </button>

      {isExpanded && children.length > 0 && (
        <CollectionTree
          nodes={children}
          collectionPath={collectionPath}
          collectionName={node.type === "collection" ? node.name : collectionName}
          depth={depth + 1}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={[
            { label: "New Request", icon: FilePlus, onClick: handleNewRequest },
            { label: "New Folder", icon: FolderPlus, onClick: handleNewFolder },
            ...(node.type === "collection"
              ? [
                  {
                    label: "Export as Postman",
                    icon: Download,
                    onClick: () => {
                      closeContextMenu();
                      exportCollectionToFile(node.path, node.name, "postman").catch(console.error);
                    },
                  },
                  {
                    label: "Export as OpenAPI",
                    icon: Download,
                    onClick: () => {
                      closeContextMenu();
                      exportCollectionToFile(node.path, node.name, "openapi").catch(console.error);
                    },
                  },
                ]
              : [
                  { label: "Rename", icon: Pencil, onClick: handleRename },
                  { label: "Delete", icon: Trash2, onClick: handleDelete, danger: true },
                ]),
          ]}
        />
      )}
    </>
  );
}

function ContextMenu({
  x,
  y,
  onClose,
  items,
}: {
  x: number;
  y: number;
  onClose: () => void;
  items: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    danger?: boolean;
  }[];
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[160px] rounded border border-[var(--color-border)] bg-[var(--color-elevated)] py-1 shadow-lg"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-border)] ${
              item.danger ? "text-red-400" : "text-[var(--color-text-primary)]"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
