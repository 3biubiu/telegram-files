import * as React from "react";
import { useMemo } from "react";
import useSWR from "swr";
import { Check, Ellipsis, FileText, Film, ImageIcon, Music, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FileType } from "@/lib/types";

export interface FileTypeOption {
  key: Exclude<FileType, "media">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  {
    key: "photo",
    label: "图片",
    icon: ImageIcon,
    color: "text-blue-500 dark:text-blue-400",
  },
  {
    key: "video",
    label: "视频",
    icon: Film,
    color: "text-purple-500 dark:text-purple-400",
  },
  {
    key: "file",
    label: "文件",
    icon: FileText,
    color: "text-amber-500 dark:text-amber-400",
  },
  {
    key: "audio",
    label: "音频",
    icon: Music,
    color: "text-emerald-500 dark:text-emerald-400",
  },
];

interface FileTypeFilterProps {
  offline: boolean;
  telegramId: string;
  chatId: string;
  types?: FileType[];
  type?: FileType | "all" | string;
  seedOnly?: boolean;
  onChange: (types: FileType[], typeStr?: string) => void;
}

export default function FileTypeFilter({
  offline,
  telegramId,
  chatId,
  types,
  type,
  seedOnly = false,
  onChange,
}: FileTypeFilterProps) {
  const countParams = new URLSearchParams({
    offline: String(offline),
    ...(offline && seedOnly && { seedOnly: "true" }),
  });

  const { data: counts, isLoading } = useSWR<Record<string, number>>(
    `/telegram/${telegramId}/chat/${chatId}/files/count?${countParams.toString()}`,
  );

  // Normalize current selected types
  const selectedTypes = useMemo<FileType[]>(() => {
    if (types && Array.isArray(types)) {
      return types.filter((t) => t !== "media");
    }
    if (!type || type === "all") {
      return [];
    }
    if (type === "media") {
      return ["photo", "video"];
    }
    return type
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is FileType =>
        ["photo", "video", "file", "audio"].includes(s),
      );
  }, [types, type]);

  const isAllSelected = selectedTypes.length === 0 || selectedTypes.length === 4;
  const isMediaOnly =
    selectedTypes.length === 2 &&
    selectedTypes.includes("photo") &&
    selectedTypes.includes("video");

  const notifyChange = (newSelected: FileType[]) => {
    const stringVal =
      newSelected.length === 0 || newSelected.length === 4
        ? "all"
        : newSelected.length === 1
          ? newSelected[0]
          : newSelected.length === 2 &&
              newSelected.includes("photo") &&
              newSelected.includes("video")
            ? "media"
            : newSelected.join(",");
    onChange(newSelected, stringVal);
  };

  const handleToggleType = (itemKey: FileType) => {
    if (isAllSelected) {
      // If previously All (empty or 4), clicking one means "only select this one"
      notifyChange([itemKey]);
      return;
    }

    if (selectedTypes.includes(itemKey)) {
      const next = selectedTypes.filter((t) => t !== itemKey);
      notifyChange(next);
    } else {
      const next = [...selectedTypes, itemKey];
      notifyChange(next);
    }
  };

  const handleSelectAll = () => {
    notifyChange([]);
  };

  const handleSelectMedia = () => {
    notifyChange(["photo", "video"]);
  };

  const allCount = counts
    ? counts.all ??
      (counts.photo || 0) +
        (counts.video || 0) +
        (counts.file || 0) +
        (counts.audio || 0)
    : undefined;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="font-medium text-sm">文件类型</Label>
          <span className="text-[11px] text-muted-foreground">(可多选)</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={isAllSelected ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[11px] font-normal"
            onClick={handleSelectAll}
          >
            全部
            {allCount !== undefined && (
              <span className="ml-1 opacity-70">({allCount})</span>
            )}
          </Button>
          <Button
            type="button"
            variant={isMediaOnly ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[11px] font-normal"
            onClick={handleSelectMedia}
            title="快捷选择: 图片 + 视频"
          >
            <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
            媒体
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FILE_TYPE_OPTIONS.map((opt) => {
          const isSelected = !isAllSelected && selectedTypes.includes(opt.key);
          const Icon = opt.icon;
          const count = counts?.[opt.key];

          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleToggleType(opt.key)}
              className={cn(
                "group relative flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-all duration-150 select-none",
                isSelected
                  ? "border-primary bg-primary/10 font-medium text-foreground shadow-xs ring-1 ring-primary/30 dark:bg-primary/20"
                  : "border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md border text-xs transition-colors",
                    isSelected
                      ? "border-primary/40 bg-primary/15 text-primary dark:text-primary-foreground"
                      : "border-border/60 bg-muted/50 group-hover:bg-muted",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", opt.color)} />
                </div>
                <span>{opt.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {isLoading ? (
                  <Ellipsis className="h-3 w-3 animate-pulse opacity-50" />
                ) : count !== undefined ? (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {count}
                  </span>
                ) : null}

                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 opacity-0 group-hover:opacity-40",
                  )}
                >
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
        <span>
          {isAllSelected
            ? "当前筛选: 全部类型"
            : `已勾选 ${selectedTypes.length} 项: ${selectedTypes
                .map((t) => FILE_TYPE_OPTIONS.find((o) => o.key === t)?.label || t)
                .join("、")}`}
        </span>
        {!isAllSelected && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-primary hover:underline"
          >
            重置为全部
          </button>
        )}
      </div>
    </div>
  );
}
