import Box from "lucide-react/dist/esm/icons/box";
import BrainCircuit from "lucide-react/dist/esm/icons/brain-circuit";
import Puzzle from "lucide-react/dist/esm/icons/puzzle";
import { useTranslation } from "react-i18next";
import { pushErrorToast } from "../../../services/toasts";

type SidebarMarketLinksProps = {
  onOpenMemory: () => void;
};

export function SidebarMarketLinks({ onOpenMemory }: SidebarMarketLinksProps) {
  const { t } = useTranslation();

  const handleClick = () => {
    pushErrorToast({
      title: t("sidebar.comingSoon"),
      message: t("sidebar.comingSoonMessage"),
      durationMs: 3000,
    });
  };

  return (
    <div className="sidebar-market-list">
      <button
        type="button"
        className="sidebar-market-item"
        onClick={handleClick}
        data-tauri-drag-region="false"
      >
        <Box className="sidebar-market-icon" />
        <span>{t("sidebar.mcpSkillsMarket")}</span>
      </button>
      <button
        type="button"
        className="sidebar-market-item"
        onClick={onOpenMemory}
        data-tauri-drag-region="false"
      >
        <BrainCircuit className="sidebar-market-icon" />
        <span>{t("sidebar.longTermMemory")}</span>
      </button>
      <button
        type="button"
        className="sidebar-market-item"
        onClick={handleClick}
        data-tauri-drag-region="false"
      >
        <Puzzle className="sidebar-market-icon" />
        <span>{t("sidebar.pluginMarket")}</span>
      </button>
    </div>
  );
}
