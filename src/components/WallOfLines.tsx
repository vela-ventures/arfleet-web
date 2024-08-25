import { useState, useEffect } from "react";
import { cn } from "../lib/utils";

type SimpleTextLineProps = {
  text: string;
  minDelay: number;
  maxDelay: number;
};

type TextLineProps = {
  text: string;
  minDelay: number;
  maxDelay: number;
  colors: string[];
  primaryColor: string;
};

type WallOfLinesProps = {
  lines: string[];
  minDelay: number;
  maxDelay: number;
  colors?: string[];
  primaryColor?: string;
  className?: string;
};

function SimpleTextLineMarquee({
  text,
  minDelay,
  maxDelay,
}: SimpleTextLineProps) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    const delayAmount =
      Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

    const intervalId = setInterval(() => {
      setDisplayText(
        (currentText) => currentText.substring(1) + currentText[0]
      );
    }, delayAmount);

    return () => {
      clearInterval(intervalId);
    };
  }, [minDelay, maxDelay]);

  return (
    <div className="bg-gradient-to-r w-full max-w-full whitespace-pre">
      {displayText}
    </div>
  );
}

function TextLineMarquee({
  text,
  minDelay,
  maxDelay,
  colors,
  primaryColor,
}: TextLineProps) {
  const [displayText, setDisplayText] = useState(text);
  const [background, setBackground] = useState("");

  useEffect(() => {
    const updateBackground = () => {
      const gradientColors = [
        ...Array.from({ length: 30 }, () => {
          return Math.random() < 0.985
            ? primaryColor
            : colors[Math.floor(Math.random() * colors.length)];
        }),
      ];

      const gradientStops = gradientColors
        .map((color) => `${color} `)
        .join(", ");

      setBackground(`linear-gradient(90deg, ${gradientStops})`);
    };

    const delayAmount =
      Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

    updateBackground(); // Initial background setup
    const intervalId = setInterval(() => {
      setDisplayText(
        (currentText) => currentText.substring(1) + currentText[0]
      );
    }, delayAmount);
    const intervalIdBackground = setInterval(() => {
      updateBackground(); // Update background on each interval
    }, delayAmount * 4);

    return () => {
      clearInterval(intervalId);
      clearInterval(intervalIdBackground);
    };
  }, [minDelay, maxDelay, colors, primaryColor]);

  return (
    <div
      style={{ backgroundImage: background }}
      className="bg-gradient-to-r w-full max-w-full whitespace-pre bg-clip-text text-transparent"
    >
      {displayText}
    </div>
  );
}

export default function WallOfLines({
  lines,
  minDelay,
  maxDelay,
  colors,
  primaryColor,
  className = ''
}: WallOfLinesProps) {
  return (
    <div className={cn("flex flex-col select-none tracking-widest font-extralight ", className)}>
      {colors && primaryColor
        ? lines.map((line, index) => (
            <TextLineMarquee
              key={"line-" + index}
              text={line}
              minDelay={minDelay}
              maxDelay={maxDelay}
              colors={colors}
              primaryColor={primaryColor}
            />
          ))
        : lines.map((line, index) => (
            <SimpleTextLineMarquee
              key={"line-" + index}
              text={line}
              minDelay={minDelay}
              maxDelay={maxDelay}
            />
          ))}
    </div>
  );
}