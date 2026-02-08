/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EngineStatus } from "../../../types";
import { TaskCreateModal } from "./TaskCreateModal";

const engineStatuses: EngineStatus[] = [
  {
    engineType: "claude",
    installed: true,
    version: "1.0.0",
    binPath: "/usr/local/bin/claude",
    features: {
      streaming: true,
      reasoning: true,
      toolUse: true,
      imageInput: true,
      sessionContinuation: true,
    },
    models: [
      {
        id: "claude-sonnet",
        displayName: "Claude Sonnet",
        description: "Default model",
        isDefault: true,
      },
    ],
    error: null,
  },
];

describe("TaskCreateModal", () => {
  it("opens correctly after an initial closed render", () => {
    const props = {
      workspaceId: "ws-1",
      panelId: "panel-1",
      defaultStatus: "todo" as const,
      engineStatuses,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };

    const { container, rerender } = render(
      <TaskCreateModal {...props} isOpen={false} />,
    );

    expect(container.querySelector(".kanban-task-modal")).toBeNull();

    expect(() => {
      rerender(<TaskCreateModal {...props} isOpen />);
    }).not.toThrow();

    expect(container.querySelector(".kanban-task-modal")).not.toBeNull();
  });
});

