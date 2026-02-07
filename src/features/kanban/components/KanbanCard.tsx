import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Draggable } from "@hello-pangea/dnd";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { KanbanTask } from "../types";
import type { EngineType } from "../../../types";
import { EngineIcon } from "../../engine/components/EngineIcon";

type KanbanCardProps = {
  task: KanbanTask;
  index: number;
  isSelected?: boolean;
  isProcessing?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const ENGINE_NAMES: Record<EngineType, string> = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
  opencode: "OpenCode",
};

export function KanbanCard({ task, index, isSelected, isProcessing, onSelect, onEdit, onDelete }: KanbanCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          className={`kanban-card${snapshot.isDragging ? " is-dragging" : ""}${isSelected ? " is-selected" : ""}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onSelect}
        >
          <div className="kanban-card-header">
            <span
              className="kanban-card-engine"
              title={ENGINE_NAMES[task.engineType] ?? task.engineType}
            >
              <EngineIcon engine={task.engineType} size={15} />
            </span>
            <span className="kanban-card-title">{task.title}</span>
            <div className="kanban-card-menu" ref={menuRef}>
              <button
                className="kanban-icon-btn kanban-card-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label={t("kanban.task.menu")}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="kanban-dropdown-menu">
                  <button
                    className="kanban-dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit();
                    }}
                  >
                    <Pencil size={14} />
                    {t("kanban.task.edit")}
                  </button>
                  <button
                    className="kanban-dropdown-item kanban-dropdown-item-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    <Trash2 size={14} />
                    {t("kanban.task.delete")}
                  </button>
                </div>
              )}
            </div>
          </div>
          {task.description && (
            <p className="kanban-card-desc">{task.description}</p>
          )}
          {isProcessing && (
            <div className="kanban-card-status-row">
              <span className="kanban-card-spinner" />
              <span className="kanban-card-processing-text">
                {t("kanban.task.processing")}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
