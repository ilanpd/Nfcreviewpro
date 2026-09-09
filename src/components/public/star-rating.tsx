"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  onSelect: (stars: number) => void;
  disabled?: boolean;
  color?: string;
}

export function StarRating({ onSelect, disabled, color = "#F59E0B" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2" role="radiogroup" aria-label="Nota da experiência">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hovered !== null ? star <= hovered : false;
        return (
          <motion.button
            key={star}
            type="button"
            role="radio"
            aria-checked={false}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            disabled={disabled}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: disabled ? 1 : 1.1 }}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(star)}
            className={cn(
              "p-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Star
              size={44}
              strokeWidth={1.5}
              color={color}
              fill={active ? color : "transparent"}
              className="sm:size-14 transition-colors"
            />
          </motion.button>
        );
      })}
    </div>
  );
}
