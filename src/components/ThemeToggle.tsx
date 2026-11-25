import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="切换主题"
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          <motion.span
            key={dark ? "sun" : "moon"}
            initial={{ rotate: -35, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="inline-flex"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "切换到浅色" : "切换到深色"}</TooltipContent>
    </Tooltip>
  );
}
