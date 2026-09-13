// mobile-app/src/components/navigation/VisualNavigationHUD.jsx
import React4 from "react";

// mobile-app/src/components/navigation/LaneAssist.jsx
import React from "react";
function LaneDirectionArrow({ maneuver, isRecommended }) {
  const color = isRecommended ? "#00F0FF" : "rgba(255, 255, 255, 0.4)";
  const strokeWidth = isRecommended ? 3.5 : 2.5;
  const m = String(maneuver || "").toUpperCase();
  if (m === "TURN_LEFT" || m === "LEFT") {
    return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M17 19 V11 C17 8.5 15 7 12 7 H5 M5 7 L9 3 M5 7 L9 11",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }
  if (m === "TURN_RIGHT" || m === "RIGHT") {
    return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M7 19 V11 C7 8.5 9 7 12 7 H19 M19 7 L15 3 M19 7 L15 11",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }
  if (m === "SLIGHT_LEFT") {
    return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M15 19 V12 C15 9 13 7 9 5 M9 5 L13 4 M9 5 L8 9",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }
  if (m === "SLIGHT_RIGHT") {
    return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M9 19 V12 C9 9 11 7 15 5 M15 5 L11 4 M15 5 L16 9",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }
  if (m === "U_TURN" || m === "UTURN") {
    return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M17 19 V10 C17 6 7 6 7 10 V19 M7 19 L3 15 M7 19 L11 15",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: color }, /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M12 19 V5 M12 5 L7 10 M12 5 L17 10",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ));
}
function LaneAssist({ laneAssist }) {
  if (!laneAssist || !laneAssist.available || !Array.isArray(laneAssist.lanes) || laneAssist.lanes.length === 0) {
    return null;
  }
  const { lanes, recommendedLane, totalLanes } = laneAssist;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "lane-assist-container",
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 12px",
        margin: "8px 0",
        background: "rgba(10, 16, 26, 0.75)",
        border: "1px solid rgba(0, 240, 255, 0.25)",
        borderRadius: 10,
        boxShadow: "inset 0 1px 6px rgba(0, 240, 255, 0.1)"
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 6
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10, fontFamily: "Chakra Petch", color: "#00F0FF", fontWeight: 700, letterSpacing: "0.06em" } }, "LANE GUIDANCE"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "(", totalLanes, " LANES)")),
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            fontSize: 9,
            fontFamily: "Chakra Petch",
            fontWeight: 700,
            color: "#00F0FF",
            background: "rgba(0, 240, 255, 0.15)",
            padding: "2px 6px",
            borderRadius: 4
          }
        },
        "LANE ",
        recommendedLane + 1,
        " RECOMMENDED"
      )
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "stretch",
          gap: 6,
          width: "100%",
          justifyContent: "center"
        }
      },
      lanes.map((lane, idx) => {
        const isRec = lane.recommended || idx === recommendedLane;
        const allowed = Array.isArray(lane.allowedManeuvers) && lane.allowedManeuvers.length > 0 ? lane.allowedManeuvers : ["STRAIGHT"];
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: idx,
            className: `lane-box ${isRec ? "lane-recommended" : "lane-neutral"}`,
            style: {
              flex: "1 1 0",
              maxWidth: 68,
              minWidth: 42,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 4px",
              borderRadius: 6,
              background: isRec ? "rgba(0, 240, 255, 0.16)" : "rgba(255, 255, 255, 0.04)",
              border: isRec ? "1.5px solid #00F0FF" : "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: isRec ? "0 0 12px rgba(0, 240, 255, 0.35)" : "none",
              transition: "all 0.25s ease"
            }
          },
          /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 2, alignItems: "center", justifyContent: "center" } }, allowed.map((m, mIdx) => /* @__PURE__ */ React.createElement(LaneDirectionArrow, { key: mIdx, maneuver: m, isRecommended: isRec }))),
          /* @__PURE__ */ React.createElement(
            "div",
            {
              style: {
                fontSize: 9,
                fontWeight: 700,
                fontFamily: "Chakra Petch",
                marginTop: 3,
                color: isRec ? "#00F0FF" : "rgba(255, 255, 255, 0.4)"
              }
            },
            idx + 1
          )
        );
      })
    )
  );
}

// mobile-app/src/components/navigation/JunctionView.jsx
import React2 from "react";
function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: Math.round(cx + radius * Math.cos(angleInRadians)),
    y: Math.round(cy + radius * Math.sin(angleInRadians))
  };
}
function JunctionView({ junctionInfo, distanceFormatted = "" }) {
  if (!junctionInfo || !junctionInfo.available) {
    return null;
  }
  const {
    bearings = [],
    inIndex,
    outIndex,
    inBearing,
    outBearing,
    maneuver = "STRAIGHT",
    currentRoad = "",
    nextRoad = "",
    distanceToJunction
  } = junctionInfo;
  const cx = 50;
  const cy = 50;
  const radius = 38;
  const baseAngle = inBearing != null ? inBearing : 180;
  const rotationOffset = 180 - baseAngle;
  const displayDist = distanceFormatted || (distanceToJunction != null ? `${Math.round(distanceToJunction)} m` : "");
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      className: "junction-view-container",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        margin: "8px 0",
        background: "linear-gradient(135deg, rgba(8, 14, 24, 0.95), rgba(12, 20, 34, 0.95))",
        border: "1px solid rgba(0, 240, 255, 0.3)",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)"
      }
    },
    /* @__PURE__ */ React2.createElement(
      "div",
      {
        style: {
          width: 72,
          height: 72,
          flexShrink: 0,
          background: "rgba(0, 0, 0, 0.4)",
          borderRadius: 8,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      },
      /* @__PURE__ */ React2.createElement("svg", { viewBox: "0 0 100 100", width: "68", height: "68", style: { overflow: "visible" } }, /* @__PURE__ */ React2.createElement("circle", { cx, cy, r: "6", fill: "#1C283E", stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: "2" }), Array.isArray(bearings) && bearings.length > 0 ? bearings.map((b, idx) => {
        const isOut = idx === outIndex;
        const isIn = idx === inIndex;
        if (isOut || isIn) return null;
        const normalizedAngle = (b + rotationOffset + 360) % 360;
        const pt = polarToCartesian(cx, cy, radius, normalizedAngle);
        return /* @__PURE__ */ React2.createElement(
          "line",
          {
            key: idx,
            x1: cx,
            y1: cy,
            x2: pt.x,
            y2: pt.y,
            stroke: "rgba(255, 255, 255, 0.22)",
            strokeWidth: "5",
            strokeLinecap: "round"
          }
        );
      }) : (
        // Default crossroad fallback if no raw bearings
        /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("line", { x1: "20", y1: "50", x2: "80", y2: "50", stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: "5", strokeLinecap: "round" }), /* @__PURE__ */ React2.createElement("line", { x1: "50", y1: "20", x2: "50", y2: "80", stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: "5", strokeLinecap: "round" }))
      ), /* @__PURE__ */ React2.createElement(
        "line",
        {
          x1: cx,
          y1: "88",
          x2: cx,
          y2: cy,
          stroke: "#00F0FF",
          strokeWidth: "6",
          strokeLinecap: "round"
        }
      ), outBearing != null ? (() => {
        const outAngle = (outBearing + rotationOffset + 360) % 360;
        const pt = polarToCartesian(cx, cy, radius, outAngle);
        return /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(
          "line",
          {
            x1: cx,
            y1: cy,
            x2: pt.x,
            y2: pt.y,
            stroke: "#30D158",
            strokeWidth: "6",
            strokeLinecap: "round"
          }
        ), /* @__PURE__ */ React2.createElement("circle", { cx: pt.x, cy: pt.y, r: "4", fill: "#30D158" }));
      })() : (
        // Outbound fallback based on maneuver direction
        (() => {
          let exitPt = { x: cx, y: 14 };
          if (maneuver.includes("LEFT")) exitPt = { x: 14, y: cy };
          if (maneuver.includes("RIGHT")) exitPt = { x: 86, y: cy };
          return /* @__PURE__ */ React2.createElement(
            "line",
            {
              x1: cx,
              y1: cy,
              x2: exitPt.x,
              y2: exitPt.y,
              stroke: "#30D158",
              strokeWidth: "6",
              strokeLinecap: "round"
            }
          );
        })()
      ), /* @__PURE__ */ React2.createElement("circle", { cx, cy: "76", r: "3.5", fill: "#ffffff" }))
    ),
    /* @__PURE__ */ React2.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 } }, /* @__PURE__ */ React2.createElement("span", { style: { fontSize: 10, fontFamily: "Chakra Petch", color: "#30D158", fontWeight: 700, letterSpacing: "0.04em" } }, "JUNCTION AHEAD"), displayDist && /* @__PURE__ */ React2.createElement("span", { style: { fontSize: 12, fontFamily: "Chakra Petch", color: "#ffffff", fontWeight: 700 } }, displayDist)), nextRoad ? /* @__PURE__ */ React2.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#00F0FF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "\u2192 ", nextRoad) : /* @__PURE__ */ React2.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)" } }, "Follow indicated road exit"), currentRoad && /* @__PURE__ */ React2.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, "From: ", currentRoad))
  );
}

// mobile-app/src/components/navigation/TrafficStatus.jsx
import React3 from "react";
function TrafficStatus({ trafficInfo }) {
  if (!trafficInfo || !trafficInfo.available) {
    return null;
  }
  const level = String(trafficInfo.level || "LOW").toUpperCase();
  const delay = trafficInfo.delayFormatted || "";
  const getTrafficBadge = (lvl) => {
    switch (lvl) {
      case "SEVERE":
        return { color: "#FF3B30", bg: "rgba(255, 59, 48, 0.18)", border: "#FF3B30", label: "TRAFFIC: SEVERE" };
      case "HIGH":
        return { color: "#FF9500", bg: "rgba(255, 149, 0, 0.18)", border: "#FF9500", label: "TRAFFIC: HEAVY" };
      case "MODERATE":
        return { color: "#FFD60A", bg: "rgba(255, 214, 10, 0.18)", border: "#FFD60A", label: "TRAFFIC: MODERATE" };
      case "LOW":
      default:
        return { color: "#30D158", bg: "rgba(48, 209, 88, 0.18)", border: "#30D158", label: "TRAFFIC: LIGHT" };
    }
  };
  const badge = getTrafficBadge(level);
  return /* @__PURE__ */ React3.createElement(
    "div",
    {
      className: "traffic-status-badge",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 6,
        background: badge.bg,
        border: `1px solid ${badge.border}`
      }
    },
    /* @__PURE__ */ React3.createElement(
      "span",
      {
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: badge.color,
          boxShadow: `0 0 6px ${badge.color}`
        }
      }
    ),
    /* @__PURE__ */ React3.createElement(
      "span",
      {
        style: {
          fontFamily: "Chakra Petch",
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          letterSpacing: "0.04em"
        }
      },
      badge.label,
      " ",
      delay ? `(+${delay})` : ""
    )
  );
}

// mobile-app/src/components/navigation/VisualNavigationHUD.jsx
function ManeuverIcon({ maneuver, size = 44, color = "currentColor" }) {
  const m = String(maneuver || "").toUpperCase().trim();
  switch (m) {
    case "TURN_LEFT":
    case "LEFT":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M22 26 V14 C22 10.7 19.3 8 16 8 H8 M8 8 L14 2 M8 8 L14 14",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "TURN_RIGHT":
    case "RIGHT":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M10 26 V14 C10 10.7 12.7 8 16 8 H24 M24 8 L18 2 M24 8 L18 14",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "SLIGHT_LEFT":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M20 26 V16 C20 12 17 9 12 7 M12 7 L17 5 M12 7 L11 13",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "SLIGHT_RIGHT":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M12 26 V16 C12 12 15 9 20 7 M20 7 L15 5 M20 7 L21 13",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "U_TURN":
    case "UTURN":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M22 26 V14 C22 8 10 8 10 14 V26 M10 26 L5 20 M10 26 L15 20",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "ROUNDABOUT":
    case "ROTARY":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement("circle", { cx: "16", cy: "16", r: "7", strokeWidth: "3" }), /* @__PURE__ */ React4.createElement("path", { d: "M16 26 V23 M16 9 V6 M6 16 L9 16 M23 16 L26 16", strokeWidth: "2.5", strokeLinecap: "round" }));
    case "MERGE":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M16 26 V6 M16 6 L10 12 M16 6 L22 12 M8 26 C8 20 13 14 16 12 M24 26 C24 20 19 14 16 12",
          strokeWidth: "3.2",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "EXIT":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M12 26 V6 M12 6 L7 11 M12 6 L17 11 M12 18 C15 16 22 15 24 10 M24 10 L19 10 M24 10 L24 15",
          strokeWidth: "3.2",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
    case "ARRIVE":
    case "ARRIVED":
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement("circle", { cx: "16", cy: "16", r: "9", strokeWidth: "3" }), /* @__PURE__ */ React4.createElement("circle", { cx: "16", cy: "16", r: "3.5", fill: color }), /* @__PURE__ */ React4.createElement("path", { d: "M16 2 V5 M16 27 V30 M2 16 H5 M27 16 H30", strokeWidth: "2", strokeLinecap: "round" }));
    case "STRAIGHT":
    case "CONTINUE":
    default:
      return /* @__PURE__ */ React4.createElement("svg", { viewBox: "0 0 32 32", width: size, height: size, fill: "none", stroke: color }, /* @__PURE__ */ React4.createElement(
        "path",
        {
          d: "M16 26 V6 M16 6 L10 12 M16 6 L22 12",
          strokeWidth: "3.5",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ));
  }
}
function getBandTheme(guidanceBand) {
  switch (guidanceBand) {
    case "NOW":
      return {
        accent: "#30D158",
        border: "1px solid #30D158",
        shadow: "0 0 28px rgba(48, 209, 88, 0.45)",
        badgeBg: "rgba(48, 209, 88, 0.2)",
        badgeText: "#30D158",
        badgeLabel: "\u26A1 TURN NOW",
        pulse: true
      };
    case "IMMEDIATE":
      return {
        accent: "#FF9500",
        border: "1px solid #FF9500",
        shadow: "0 0 24px rgba(255, 149, 0, 0.35)",
        badgeBg: "rgba(255, 149, 0, 0.2)",
        badgeText: "#FF9500",
        badgeLabel: "\u26A0\uFE0F IMMEDIATE TURN",
        pulse: true
      };
    case "SOON":
      return {
        accent: "#FFD60A",
        border: "1px solid #FFD60A",
        shadow: "0 0 20px rgba(255, 214, 10, 0.25)",
        badgeBg: "rgba(255, 214, 10, 0.18)",
        badgeText: "#FFD60A",
        badgeLabel: "PREPARE TO TURN",
        pulse: false
      };
    case "APPROACHING":
      return {
        accent: "#00F0FF",
        border: "1px solid #00F0FF",
        shadow: "0 0 22px rgba(0, 240, 255, 0.28)",
        badgeBg: "rgba(0, 240, 255, 0.15)",
        badgeText: "#00F0FF",
        badgeLabel: "APPROACHING",
        pulse: false
      };
    case "NORMAL":
    default:
      return {
        accent: "#00F0FF",
        border: "1px solid rgba(0, 240, 255, 0.4)",
        shadow: "0 6px 20px rgba(0, 240, 255, 0.15)",
        badgeBg: "rgba(0, 240, 255, 0.1)",
        badgeText: "#00F0FF",
        badgeLabel: "NAVIGATING",
        pulse: false
      };
  }
}
function VisualNavigationHUD({
  navigationGuidance,
  navTelemetry,
  currentLocation,
  destination,
  isOffRoute = false,
  isRecalculating = false,
  isDestinationReached = false,
  isGpsSignalLost = false,
  isVoiceEnabled = true,
  onToggleVoice,
  onStopNavigation
}) {
  const g = navigationGuidance || navTelemetry || {};
  const isArrived = Boolean(
    isDestinationReached || g.arrived || g.navigationStatus === "ARRIVED" || g.nextManeuver === "ARRIVE"
  );
  const maneuver = isArrived ? "ARRIVE" : isRecalculating ? "CONTINUE" : g.nextManeuver || "CONTINUE";
  const guidanceBand = isArrived ? "NORMAL" : g.guidanceBand || "NORMAL";
  const theme = getBandTheme(guidanceBand);
  const distanceFormatted = isArrived ? "0 m" : g.distanceToManeuverFormatted || g.distanceToNextTurnFormatted || "0 m";
  const instruction = isArrived ? "You have arrived at your destination." : isRecalculating ? "Recalculating route..." : g.nextInstruction || g.currentStep?.instruction || "Follow highlighted route";
  const currentRoad = currentLocation?.roadName || g.currentStep?.currentRoad || "";
  const nextRoad = g.nextRoadName || g.currentStep?.roadName || "";
  const progressPercent = Math.max(0, Math.min(100, Math.round(g.progress || 0)));
  const remainingDist = isArrived ? "0 m" : g.remainingDistanceFormatted || g.distanceRemainingFormatted || "0 m";
  const remainingEta = isArrived ? "0 min" : g.remainingDurationFormatted || g.eta || "1 min";
  const currentSpeed = currentLocation?.speed != null && Number.isFinite(currentLocation.speed) ? Math.round(currentLocation.speed * 3.6) : 0;
  return /* @__PURE__ */ React4.createElement(
    "div",
    {
      className: "card visual-nav-hud",
      style: {
        marginBottom: 14,
        background: "linear-gradient(135deg, rgba(14, 22, 36, 0.98), rgba(8, 12, 20, 0.98))",
        border: isOffRoute ? "1px solid #FF9500" : theme.border,
        boxShadow: isOffRoute ? "0 0 24px rgba(255, 149, 0, 0.35)" : theme.shadow,
        padding: 16,
        borderRadius: 14,
        position: "relative",
        overflow: "hidden",
        transition: "border 0.3s ease, box-shadow 0.3s ease"
      }
    },
    !isArrived && /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "rgba(255, 255, 255, 0.08)"
        }
      },
      /* @__PURE__ */ React4.createElement(
        "div",
        {
          style: {
            height: "100%",
            width: `${progressPercent}%`,
            background: "linear-gradient(90deg, #00F0FF, #30D158)",
            boxShadow: "0 0 8px #00F0FF",
            transition: "width 0.5s ease"
          }
        }
      )
    ),
    isGpsSignalLost && !isArrived && /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          background: "rgba(255, 59, 48, 0.2)",
          border: "1px solid #FF3B30",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          boxShadow: "0 0 16px rgba(255, 59, 48, 0.3)"
        }
      },
      /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 13 } }, "\u{1F4E1}"), /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#FF3B30", fontFamily: "Chakra Petch" } }, "GPS SIGNAL LOST")),
      /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 11, color: "#ffffff", fontFamily: "Chakra Petch", fontWeight: 600 } }, "WAITING FOR GPS...")
    ),
    isOffRoute && /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          background: "rgba(255, 149, 0, 0.15)",
          border: "1px solid rgba(255, 149, 0, 0.45)",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        }
      },
      /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 13 } }, "\u26A0\uFE0F"), /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#FF9500", fontFamily: "Chakra Petch" } }, "OFF ROUTE ", g.offRouteDistance ? `(${Math.round(g.offRouteDistance)}m)` : "")),
      /* @__PURE__ */ React4.createElement("span", { style: { fontSize: 11, color: "#ffffff", fontFamily: "Chakra Petch", fontWeight: 600 } }, isRecalculating ? "RECALCULATING ROUTE..." : "RECALCULATING WITH MAPPLS...")
    ),
    isArrived ? /* @__PURE__ */ React4.createElement("div", { style: { textAlign: "center", padding: "14px 0" } }, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 36, marginBottom: 6 } }, "\u{1F3C1}"), /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          fontFamily: "Chakra Petch",
          fontSize: 20,
          fontWeight: 800,
          color: "#30D158",
          letterSpacing: "0.04em"
        }
      },
      "YOU HAVE ARRIVED"
    ), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 13, color: "var(--text-muted)", marginTop: 4 } }, destination?.name || destination?.address || "Your Destination"), /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "center",
          gap: 16,
          margin: "14px 0",
          padding: "10px 16px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: 8
        }
      },
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "STATUS"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#30D158", fontFamily: "Chakra Petch" } }, "TRIP COMPLETE")),
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "REMAINING"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#ffffff", fontFamily: "Chakra Petch" } }, "0 m")),
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "PROGRESS"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#ffffff", fontFamily: "Chakra Petch" } }, "100%"))
    ), /* @__PURE__ */ React4.createElement(
      "button",
      {
        onClick: onStopNavigation,
        className: "btn-primary",
        style: {
          marginTop: 6,
          padding: "10px 28px",
          fontFamily: "Chakra Petch",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.04em"
        }
      },
      "FINISH TRIP"
    )) : /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12
        }
      },
      /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, /* @__PURE__ */ React4.createElement(
        "span",
        {
          style: {
            fontSize: 10,
            fontFamily: "Chakra Petch",
            fontWeight: 800,
            letterSpacing: "0.06em",
            padding: "3px 8px",
            borderRadius: 4,
            background: theme.badgeBg,
            color: theme.badgeText,
            border: `1px solid ${theme.accent}`,
            textTransform: "uppercase"
          }
        },
        theme.badgeLabel
      ), /* @__PURE__ */ React4.createElement(
        "span",
        {
          style: {
            fontSize: 10,
            fontFamily: "Chakra Petch",
            color: "var(--text-muted)",
            fontWeight: 600
          }
        },
        progressPercent,
        "% COMPLETE"
      ), /* @__PURE__ */ React4.createElement(TrafficStatus, { trafficInfo: g.trafficInfo })),
      typeof onToggleVoice === "function" && /* @__PURE__ */ React4.createElement(
        "button",
        {
          onClick: onToggleVoice,
          style: {
            background: isVoiceEnabled ? "rgba(0, 240, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${isVoiceEnabled ? "#00F0FF" : "rgba(255, 255, 255, 0.18)"}`,
            color: isVoiceEnabled ? "#00F0FF" : "var(--text-muted)",
            borderRadius: 14,
            padding: "3px 9px",
            fontSize: 10,
            fontFamily: "Chakra Petch",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            transition: "all 0.2s ease"
          },
          title: isVoiceEnabled ? "Voice Guidance Active" : "Voice Guidance Muted"
        },
        /* @__PURE__ */ React4.createElement("span", null, isVoiceEnabled ? "\u{1F50A}" : "\u{1F507}"),
        /* @__PURE__ */ React4.createElement("span", null, isVoiceEnabled ? "VOICE" : "MUTED")
      )
    ), /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 14 } }, /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          width: 64,
          height: 64,
          borderRadius: 14,
          background: `radial-gradient(circle, ${theme.badgeBg}, rgba(0, 0, 0, 0.4))`,
          border: `2px solid ${theme.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 0 20px ${theme.accent}44`,
          transition: "border 0.3s ease, box-shadow 0.3s ease"
        }
      },
      /* @__PURE__ */ React4.createElement(ManeuverIcon, { maneuver, size: 38, color: theme.accent })
    ), /* @__PURE__ */ React4.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } }, /* @__PURE__ */ React4.createElement(
      "span",
      {
        style: {
          fontSize: 32,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "Chakra Petch",
          letterSpacing: "-0.02em",
          lineHeight: 1
        }
      },
      distanceFormatted
    ), /* @__PURE__ */ React4.createElement(
      "span",
      {
        style: {
          fontSize: 10,
          color: theme.accent,
          fontFamily: "Chakra Petch",
          fontWeight: 700,
          letterSpacing: "0.06em"
        }
      },
      "TO TURN"
    )), /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          fontSize: 15,
          fontWeight: 700,
          color: "#ffffff",
          fontFamily: "Chakra Petch",
          marginTop: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      },
      instruction
    ), /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 } }, currentRoad && /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 11, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, /* @__PURE__ */ React4.createElement("span", { style: { color: "rgba(255,255,255,0.4)", marginRight: 3 } }, "ON"), /* @__PURE__ */ React4.createElement("span", null, currentRoad)), nextRoad && /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 11, color: theme.accent, fontFamily: "Chakra Petch", fontWeight: 600 } }, /* @__PURE__ */ React4.createElement("span", { style: { color: "rgba(255,255,255,0.4)", marginRight: 3 } }, "NEXT"), /* @__PURE__ */ React4.createElement("span", null, nextRoad))))), /* @__PURE__ */ React4.createElement(LaneAssist, { laneAssist: g.laneAssist }), /* @__PURE__ */ React4.createElement(JunctionView, { junctionInfo: g.junctionInfo, distanceFormatted }), /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 8,
          marginBottom: 12,
          textAlign: "center"
        }
      },
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "REMAINING"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#ffffff", fontFamily: "Chakra Petch", marginTop: 2 } }, remainingDist)),
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "EST. ARRIVAL"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#00F0FF", fontFamily: "Chakra Petch", marginTop: 2 } }, remainingEta)),
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 9, color: "var(--text-muted)", fontFamily: "Chakra Petch" } }, "SPEED"), /* @__PURE__ */ React4.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#ffffff", fontFamily: "Chakra Petch", marginTop: 2 } }, currentSpeed, " km/h"))
    ), g.nextStep && g.nextStep.instruction && /* @__PURE__ */ React4.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 12,
          padding: "6px 10px",
          background: "rgba(255, 255, 255, 0.02)",
          borderRadius: 6,
          border: "1px solid rgba(255, 255, 255, 0.04)"
        }
      },
      /* @__PURE__ */ React4.createElement(ManeuverIcon, { maneuver: g.nextStep.normalizedManeuver || g.nextStep.turnDirection, size: 16, color: "#00F0FF" }),
      /* @__PURE__ */ React4.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "Then: ", g.nextStep.instruction)
    ), /* @__PURE__ */ React4.createElement(
      "button",
      {
        onClick: onStopNavigation,
        style: {
          width: "100%",
          padding: "10px 14px",
          fontSize: 13,
          fontFamily: "Chakra Petch",
          fontWeight: 700,
          letterSpacing: "0.04em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "rgba(255, 69, 58, 0.15)",
          color: "#ff453a",
          border: "1px solid rgba(255, 69, 58, 0.35)",
          borderRadius: 8,
          cursor: "pointer",
          transition: "all 0.2s ease"
        }
      },
      /* @__PURE__ */ React4.createElement("span", null, "\u{1F6D1}"),
      /* @__PURE__ */ React4.createElement("span", null, "STOP NAVIGATION")
    ))
  );
}
var VisualNavigationHUD_default = VisualNavigationHUD;
export {
  ManeuverIcon,
  VisualNavigationHUD,
  VisualNavigationHUD_default as default,
  getBandTheme
};
