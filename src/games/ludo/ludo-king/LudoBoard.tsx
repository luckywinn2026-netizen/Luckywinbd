import React from "react";

const BC = {
  red: "#c62828",
  redBg: "#e53935",
  green: "#2e7d32",
  greenBg: "#43a047",
  blue: "#1565c0",
  blueBg: "#1e88e5",
  yellow: "#f9a825",
  yellowBg: "#fdd835",
  path: "#fef9ef",
  border: "#5d4037",
  innerBg: "#fafafa",
};

// ⭐ Correct Safe Star Squares (4)
const SAFE_SET = new Set(["2,6", "6,12", "12,8", "8,2"]);

// ⬅️ Correct Indian Ludo Entry Points
const START_MAP: Record<string, { color: string; arrow: string }> = {
  "6,1": { color: BC.greenBg, arrow: "▶" }, // Green enters right
  "1,8": { color: BC.yellowBg, arrow: "▼" }, // Yellow enters down
  "8,13": { color: BC.blueBg, arrow: "◀" }, // Blue enters left
  "13,6": { color: BC.redBg, arrow: "▲" }, // Red enters up
};

// Base token circle positions
const CIRCLE_MAP: Record<string, string> = {
  "2,2": BC.greenBg,
  "2,4": BC.greenBg,
  "4,2": BC.greenBg,
  "4,4": BC.greenBg,
  "2,11": BC.yellowBg,
  "2,13": BC.yellowBg,
  "4,11": BC.yellowBg,
  "4,13": BC.yellowBg,
  "11,2": BC.redBg,
  "11,4": BC.redBg,
  "13,2": BC.redBg,
  "13,4": BC.redBg,
  "11,11": BC.blueBg,
  "11,13": BC.blueBg,
  "13,11": BC.blueBg,
  "13,13": BC.blueBg,
};

// Base detection
const getBase = (r: number, c: number) => {
  if (r < 6 && c < 6) return "green";
  if (r < 6 && c > 8) return "yellow";
  if (r > 8 && c < 6) return "red";
  if (r > 8 && c > 8) return "blue";
  return null;
};

const baseBg: Record<string, string> = {
  red: BC.redBg,
  green: BC.greenBg,
  blue: BC.blueBg,
  yellow: BC.yellowBg,
};

const isInner = (r: number, c: number) =>
  (r >= 1 && r <= 4 && c >= 1 && c <= 4) ||
  (r >= 1 && r <= 4 && c >= 10 && c <= 13) ||
  (r >= 10 && r <= 13 && c >= 1 && c <= 4) ||
  (r >= 10 && r <= 13 && c >= 10 && c <= 13);

const isCross = (r: number, c: number) => (c >= 6 && c <= 8) || (r >= 6 && r <= 8);

// Home stretches
const getHome = (r: number, c: number) => {
  if (r === 7 && c >= 1 && c <= 6) return BC.greenBg;   // Green home lane (left arm)
  if (c === 7 && r >= 1 && r <= 6) return BC.yellowBg;  // Yellow home lane (top arm)
  if (r === 7 && c >= 8 && c <= 13) return BC.blueBg;   // Blue home lane (right arm)
  if (c === 7 && r >= 8 && r <= 13) return BC.redBg;    // Red home lane (bottom arm)
  return null;
};

// Center design
const CENTER_BG: Record<string, string> = {
  "6,7": BC.yellowBg,  // Top arm → Yellow
  "7,6": BC.greenBg,   // Left arm → Green
  "7,8": BC.blueBg,    // Right arm → Blue
  "8,7": BC.redBg,     // Bottom arm → Red
};

const CENTER_DIAG: Record<string, string> = {
  "6,6": `linear-gradient(225deg, ${BC.yellowBg} 50%, ${BC.greenBg} 50%)`,  // Yellow+Green
  "6,8": `linear-gradient(135deg, ${BC.yellowBg} 50%, ${BC.blueBg} 50%)`,   // Yellow+Blue
  "8,6": `linear-gradient(135deg, ${BC.greenBg} 50%, ${BC.redBg} 50%)`,     // Green+Red
  "8,8": `linear-gradient(225deg, ${BC.blueBg} 50%, ${BC.redBg} 50%)`,      // Blue+Red
};

const BoardCell = React.memo(({ r, c }: { r: number; c: number }) => {
  const key = `${r},${c}`;
  const base = getBase(r, c);

  if (base && !isCross(r, c)) {
    if (isInner(r, c)) {
      const circle = CIRCLE_MAP[key];
      return (
        <div className="flex items-center justify-center" style={{ background: BC.innerBg }}>
          {circle && (
            <div
              className="w-[62%] h-[62%] rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${circle}cc, ${circle})`,
                boxShadow: "inset 0 1px 3px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.25)",
              }}
            />
          )}
        </div>
      );
    }
    return <div style={{ background: baseBg[base] }} />;
  }

  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    if (r === 7 && c === 7) {
      return (
        <div
          style={{
            background: `conic-gradient(from 225deg,
              ${BC.redBg} 0deg 90deg,
              ${BC.greenBg} 90deg 180deg,
              ${BC.blueBg} 180deg 270deg,
              ${BC.yellowBg} 270deg 360deg)`,
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-[40%] h-[40%] rounded-full"
              style={{
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 0 6px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        </div>
      );
    }
    if (CENTER_DIAG[key]) return <div style={{ background: CENTER_DIAG[key] }} />;
    if (CENTER_BG[key]) return <div style={{ background: CENTER_BG[key] }} />;
  }

  const homeColor = getHome(r, c);
  if (homeColor) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          background: homeColor,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div className="w-[28%] h-[28%] rounded-full" style={{ background: "rgba(255,255,255,0.35)" }} />
      </div>
    );
  }

  if (isCross(r, c)) {
    const startInfo = START_MAP[key];
    const isSafe = SAFE_SET.has(key);

    return (
      <div
        className="flex items-center justify-center"
        style={{
          background: startInfo ? startInfo.color : BC.path,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {startInfo ? (
          <span
            style={{
              color: "#fff",
              fontSize: "8px",
              fontWeight: "bold",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          >
            {startInfo.arrow}
          </span>
        ) : isSafe ? (
          <div
            className="flex items-center justify-center"
            style={{
              width: "80%",
              height: "80%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #fff7e0, #ffd54f 40%, #ff8f00 100%)",
              boxShadow: "0 0 6px 2px rgba(255,160,0,0.45), inset 0 1px 3px rgba(255,255,255,0.6)",
            }}
          >
            <span style={{ color: "#bf360c", fontSize: "13px", fontWeight: "bold", lineHeight: 1, textShadow: "0 1px 1px rgba(0,0,0,0.2)" }}>★</span>
          </div>
        ) : null}
      </div>
    );
  }

  return <div style={{ background: "#37474f" }} />;
});

const LudoBoard = React.memo(() => (
  <div
    className="w-full h-full rounded-lg overflow-hidden"
    style={{
      background: BC.border,
      padding: "3px",
      boxShadow: "inset 0 2px 8px rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.45)",
    }}
  >
    <div className="w-full h-full grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)] rounded-md overflow-hidden">
      {Array.from({ length: 225 }, (_, i) => (
        <BoardCell key={i} r={Math.floor(i / 15)} c={i % 15} />
      ))}
    </div>
  </div>
));

export default LudoBoard;
