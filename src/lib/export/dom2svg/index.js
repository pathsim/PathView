// src/utils/dom.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XMLNS_NS = "http://www.w3.org/2000/xmlns/";
function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isSvgElement(element) {
  return element.namespaceURI === SVG_NS;
}
function isImageElement(element) {
  return element instanceof HTMLImageElement;
}
function isCanvasElement(element) {
  return element instanceof HTMLCanvasElement;
}
function isFormElement(element) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}
function createSvgElement(doc, tagName) {
  return doc.createElementNS(SVG_NS, tagName);
}
function setAttributes(element, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
    if (key === "href") {
      element.setAttributeNS(XLINK_NS, "xlink:href", String(value));
    }
  }
}
function getPseudoStyles(element, pseudo) {
  return window.getComputedStyle(element, pseudo);
}

// src/utils/id-generator.ts
var globalCounter = 0;
function createIdGenerator() {
  return {
    next(prefix = "d2s") {
      return `${prefix}-${globalCounter++}`;
    }
  };
}

// src/core/styles.ts
function isInvisible(styles) {
  return styles.display === "none";
}
function isVisibilityHidden(styles) {
  return styles.visibility === "hidden";
}
function parseBorderSide(width, style, color) {
  return {
    width: parseFloat(width) || 0,
    style,
    color
  };
}
function parseBorders(styles) {
  return {
    top: parseBorderSide(
      styles.borderTopWidth,
      styles.borderTopStyle,
      styles.borderTopColor
    ),
    right: parseBorderSide(
      styles.borderRightWidth,
      styles.borderRightStyle,
      styles.borderRightColor
    ),
    bottom: parseBorderSide(
      styles.borderBottomWidth,
      styles.borderBottomStyle,
      styles.borderBottomColor
    ),
    left: parseBorderSide(
      styles.borderLeftWidth,
      styles.borderLeftStyle,
      styles.borderLeftColor
    )
  };
}
function parseBorderRadii(styles) {
  return {
    topLeft: parseRadiusPair(styles.borderTopLeftRadius),
    topRight: parseRadiusPair(styles.borderTopRightRadius),
    bottomRight: parseRadiusPair(styles.borderBottomRightRadius),
    bottomLeft: parseRadiusPair(styles.borderBottomLeftRadius)
  };
}
function parseRadiusPair(value) {
  const parts = value.split(/\s+/).map((v) => parseFloat(v) || 0);
  return [parts[0] ?? 0, parts[1] ?? parts[0] ?? 0];
}
function hasBorder(borders) {
  return borders.top.width > 0 && borders.top.style !== "none" || borders.right.width > 0 && borders.right.style !== "none" || borders.bottom.width > 0 && borders.bottom.style !== "none" || borders.left.width > 0 && borders.left.style !== "none";
}
function hasRadius(radii) {
  return radii.topLeft[0] > 0 || radii.topLeft[1] > 0 || radii.topRight[0] > 0 || radii.topRight[1] > 0 || radii.bottomRight[0] > 0 || radii.bottomRight[1] > 0 || radii.bottomLeft[0] > 0 || radii.bottomLeft[1] > 0;
}
function isUniformRadius(radii) {
  const [rx, ry] = radii.topLeft;
  return radii.topRight[0] === rx && radii.topRight[1] === ry && radii.bottomRight[0] === rx && radii.bottomRight[1] === ry && radii.bottomLeft[0] === rx && radii.bottomLeft[1] === ry;
}
function hasOverflowClip(styles) {
  const clipped = /* @__PURE__ */ new Set(["hidden", "clip", "scroll", "auto"]);
  return clipped.has(styles.overflow) || clipped.has(styles.overflowX) || clipped.has(styles.overflowY);
}
function parseBackgroundColor(styles) {
  const bg = styles.backgroundColor;
  if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return null;
  return bg;
}
function hasBackgroundImage(styles) {
  return !!styles.backgroundImage && styles.backgroundImage !== "none";
}
function createsStackingContext(styles) {
  if (styles.position !== "static" && styles.position !== "" && styles.zIndex !== "auto") {
    return true;
  }
  if (parseFloat(styles.opacity) < 1) return true;
  if (styles.transform && styles.transform !== "none") return true;
  if (styles.filter && styles.filter !== "none") return true;
  if (styles.isolation === "isolate") return true;
  if (styles.mixBlendMode && styles.mixBlendMode !== "normal") return true;
  return false;
}
function getZIndex(styles) {
  if (styles.zIndex === "auto" || !styles.zIndex) return 0;
  return parseInt(styles.zIndex, 10) || 0;
}
function isPositioned(styles) {
  return styles.position !== "static" && styles.position !== "";
}
function isFloat(styles) {
  return styles.cssFloat !== "none" && styles.cssFloat !== "";
}
function clampRadii(radii, width, height) {
  const topH = radii.topLeft[0] + radii.topRight[0];
  const bottomH = radii.bottomLeft[0] + radii.bottomRight[0];
  const leftV = radii.topLeft[1] + radii.bottomLeft[1];
  const rightV = radii.topRight[1] + radii.bottomRight[1];
  let f = 1;
  if (topH > 0) f = Math.min(f, width / topH);
  if (bottomH > 0) f = Math.min(f, width / bottomH);
  if (leftV > 0) f = Math.min(f, height / leftV);
  if (rightV > 0) f = Math.min(f, height / rightV);
  if (f >= 1) return radii;
  return {
    topLeft: [radii.topLeft[0] * f, radii.topLeft[1] * f],
    topRight: [radii.topRight[0] * f, radii.topRight[1] * f],
    bottomRight: [radii.bottomRight[0] * f, radii.bottomRight[1] * f],
    bottomLeft: [radii.bottomLeft[0] * f, radii.bottomLeft[1] * f]
  };
}
function isInlineLevel(styles) {
  const d = styles.display;
  return d === "inline" || d === "inline-block" || d === "inline-flex" || d === "inline-grid" || d === "inline-table";
}

// src/utils/geometry.ts
function getRelativeBox(element, root) {
  const elRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return {
    x: elRect.left - rootRect.left,
    y: elRect.top - rootRect.top,
    width: elRect.width,
    height: elRect.height
  };
}
function buildRoundedRectPath(x, y, width, height, radii) {
  const [tlx, tly] = radii.topLeft;
  const [trx, try_] = radii.topRight;
  const [brx, bry] = radii.bottomRight;
  const [blx, bly] = radii.bottomLeft;
  return [
    `M ${x + tlx} ${y}`,
    `L ${x + width - trx} ${y}`,
    trx || try_ ? `A ${trx} ${try_} 0 0 1 ${x + width} ${y + try_}` : "",
    `L ${x + width} ${y + height - bry}`,
    brx || bry ? `A ${brx} ${bry} 0 0 1 ${x + width - brx} ${y + height}` : "",
    `L ${x + blx} ${y + height}`,
    blx || bly ? `A ${blx} ${bly} 0 0 1 ${x} ${y + height - bly}` : "",
    `L ${x} ${y + tly}`,
    tlx || tly ? `A ${tlx} ${tly} 0 0 1 ${x + tlx} ${y}` : "",
    "Z"
  ].filter(Boolean).join(" ");
}

// src/assets/gradients.ts
function parseLinearGradient(value) {
  const match = value.match(/linear-gradient\((.+)\)/);
  if (!match) return null;
  const body = match[1];
  const parts = splitGradientArgs(body);
  if (parts.length < 2) return null;
  let angle = 180;
  let stopsStart = 0;
  const first = parts[0].trim();
  if (first.startsWith("to ")) {
    angle = directionToAngle(first);
    stopsStart = 1;
  } else if (first.match(/^-?[\d.]+(?:deg|rad|turn|grad)/)) {
    angle = parseAngle(first);
    stopsStart = 1;
  }
  const stops = [];
  const rawStops = parts.slice(stopsStart);
  for (let i = 0; i < rawStops.length; i++) {
    const { color, position } = parseColorStop(rawStops[i].trim(), i, rawStops.length);
    stops.push({ color, position });
  }
  return { angle, stops };
}
function createSvgLinearGradient(gradient, box, ctx) {
  const id = ctx.idGenerator.next("grad");
  const el = createSvgElement(
    ctx.svgDocument,
    "linearGradient"
  );
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const angleRad = gradient.angle * Math.PI / 180;
  const dx = Math.sin(angleRad);
  const dy = -Math.cos(angleRad);
  const halfLen = Math.abs(box.width / 2 * dx) + Math.abs(box.height / 2 * dy);
  const x1 = cx - dx * halfLen;
  const y1 = cy - dy * halfLen;
  const x2 = cx + dx * halfLen;
  const y2 = cy + dy * halfLen;
  setAttributes(el, {
    id,
    gradientUnits: "userSpaceOnUse",
    x1: x1.toFixed(2),
    y1: y1.toFixed(2),
    x2: x2.toFixed(2),
    y2: y2.toFixed(2)
  });
  for (const stop of gradient.stops) {
    const stopEl = createSvgElement(ctx.svgDocument, "stop");
    setAttributes(stopEl, {
      offset: `${(stop.position * 100).toFixed(1)}%`,
      "stop-color": stop.color
    });
    el.appendChild(stopEl);
  }
  ctx.defs.appendChild(el);
  return el;
}
function rasterizeGradient(value, width, height) {
  if (value.includes("conic-gradient")) {
    return rasterizeConicGradient(value, width, height);
  }
  if (value.includes("radial-gradient")) {
    return rasterizeRadialGradient(value, width, height);
  }
  return null;
}
function rasterizeConicGradient(value, width, height) {
  const match = value.match(/conic-gradient\((.+)\)/);
  if (!match) return null;
  const scale2 = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale2);
  canvas.height = Math.ceil(height * scale2);
  const ctx = canvas.getContext("2d");
  if (!ctx || !("createConicGradient" in ctx)) return null;
  ctx.scale(scale2, scale2);
  const body = match[1];
  const parts = splitGradientArgs(body);
  let startDeg = 0;
  let stopsStart = 0;
  const first = parts[0].trim();
  const fromMatch = first.match(/^from\s+(-?[\d.]+)(deg|rad|turn|grad)/);
  if (fromMatch) {
    startDeg = parseAngle(fromMatch[1] + fromMatch[2]);
    stopsStart = 1;
  }
  const cx = width / 2;
  const cy = height / 2;
  const startRad = (startDeg - 90) * Math.PI / 180;
  const gradient = ctx.createConicGradient(startRad, cx, cy);
  const rawStops = parts.slice(stopsStart);
  for (let i = 0; i < rawStops.length; i++) {
    const stop = rawStops[i].trim();
    const { color, position } = parseColorStop(stop, i, rawStops.length);
    try {
      gradient.addColorStop(position, color);
    } catch {
    }
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/png");
}
function rasterizeRadialGradient(value, width, height) {
  const match = value.match(/radial-gradient\((.+)\)/);
  if (!match) return null;
  const scale2 = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale2);
  canvas.height = Math.ceil(height * scale2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale2, scale2);
  const body = match[1];
  const parts = splitGradientArgs(body);
  let isCircle = false;
  let stopsStart = 0;
  let customCx = null;
  let customCy = null;
  const first = parts[0].trim();
  if (first === "circle" || first.startsWith("circle ")) {
    isCircle = true;
    stopsStart = 1;
  } else if (first === "ellipse" || first.startsWith("ellipse ")) {
    stopsStart = 1;
  } else if (first.includes("at ") && !first.includes("#") && !first.match(/^(rgb|hsl)/)) {
    stopsStart = 1;
  }
  if (stopsStart === 1) {
    const atMatch = first.match(/at\s+(.+)/);
    if (atMatch) {
      const posParts = atMatch[1].trim().split(/\s+/);
      customCx = parseLengthOrPercent(posParts[0], width);
      customCy = parseLengthOrPercent(posParts[1] ?? posParts[0], height);
    }
  }
  const cx = customCx ?? width / 2;
  const cy = customCy ?? height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const radius = isCircle ? Math.sqrt(rx * rx + ry * ry) : Math.max(rx, ry);
  ctx.save();
  if (!isCircle && rx !== ry) {
    ctx.translate(cx, cy);
    ctx.scale(rx / radius, ry / radius);
    ctx.translate(-cx, -cy);
  }
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const rawStops = parts.slice(stopsStart);
  for (let i = 0; i < rawStops.length; i++) {
    const stop = rawStops[i].trim();
    const { color, position } = parseColorStop(stop, i, rawStops.length);
    try {
      gradient.addColorStop(position, color);
    } catch {
    }
  }
  ctx.fillStyle = gradient;
  if (!isCircle && rx !== ry) {
    const sx = radius / rx;
    const sy = radius / ry;
    ctx.fillRect(cx * (1 - sx), cy * (1 - sy), width * sx, height * sy);
  } else {
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
  return canvas.toDataURL("image/png");
}
function parseColorStop(stop, index, total) {
  const lastParen = stop.lastIndexOf(")");
  const tail = lastParen >= 0 ? stop.slice(lastParen + 1) : stop;
  const posMatch = tail.match(/\s+([\d.]+%)\s*$/);
  if (posMatch) {
    const posStr = posMatch[1];
    const colorEnd = stop.length - posMatch[0].length;
    return {
      color: stop.slice(0, colorEnd).trim(),
      position: parseFloat(posStr) / 100
    };
  }
  if (lastParen < 0) {
    const spaceIdx = stop.lastIndexOf(" ");
    if (spaceIdx > 0 && stop.slice(spaceIdx).match(/[\d.]+%/)) {
      return {
        color: stop.slice(0, spaceIdx).trim(),
        position: parseFloat(stop.slice(spaceIdx)) / 100
      };
    }
  }
  return {
    color: stop,
    position: total > 1 ? index / (total - 1) : 0
  };
}
function splitGradientArgs(str) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}
function directionToAngle(dir) {
  const map = {
    "to top": 0,
    "to right": 90,
    "to bottom": 180,
    "to left": 270,
    "to top right": 45,
    "to top left": 315,
    "to bottom right": 135,
    "to bottom left": 225
  };
  return map[dir] ?? 180;
}
function parseAngle(value) {
  if (value.endsWith("deg")) return parseFloat(value);
  if (value.endsWith("rad")) return parseFloat(value) * 180 / Math.PI;
  if (value.endsWith("turn")) return parseFloat(value) * 360;
  if (value.endsWith("grad")) return parseFloat(value) * 0.9;
  return parseFloat(value);
}
function parseLengthOrPercent(value, containerSize) {
  if (value === "center") return containerSize / 2;
  if (value === "left" || value === "top") return 0;
  if (value === "right" || value === "bottom") return containerSize;
  if (value.endsWith("%")) return parseFloat(value) / 100 * containerSize;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// src/assets/images.ts
var IMAGE_TIMEOUT_MS = 1e4;
var MAX_CANVAS_DIM = 4096;
async function imageToDataUrl(url) {
  if (url.startsWith("data:")) return url;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => {
      console.warn(`dom2svg: Image load timed out after ${IMAGE_TIMEOUT_MS}ms, using original URL: ${url}`);
      img.onload = null;
      img.onerror = null;
      resolve(url);
    }, IMAGE_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
          const scale2 = MAX_CANVAS_DIM / Math.max(w, h);
          w = Math.round(w * scale2);
          h = Math.round(h * scale2);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(url);
        }
      } catch {
        console.warn(`dom2svg: CORS prevented inlining image, external URL will remain in SVG: ${url}`);
        resolve(url);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      console.warn(`dom2svg: Failed to load image, external URL will remain in SVG: ${url}`);
      resolve(url);
    };
    img.src = url;
  });
}
function extractUrlFromCss(value) {
  const match = value.match(/url\(["']?([^"')]+)["']?\)/);
  return match?.[1] ?? null;
}
function canvasToDataUrl(canvas) {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

// src/transforms/parse.ts
function parseTransform(value) {
  if (!value || value === "none") return [];
  const functions = [];
  const regex = /(\w+)\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const name = match[1];
    const args = match[2].split(",").map((s) => s.trim());
    switch (name) {
      case "matrix": {
        const vals = args.map(parseFloat);
        if (vals.length === 6) {
          functions.push({
            type: "matrix",
            values: vals
          });
        }
        break;
      }
      case "translate": {
        const x = parseLengthValue(args[0]);
        const y = args[1] ? parseLengthValue(args[1]) : 0;
        functions.push({ type: "translate", x, y });
        break;
      }
      case "translateX": {
        functions.push({ type: "translate", x: parseLengthValue(args[0]), y: 0 });
        break;
      }
      case "translateY": {
        functions.push({ type: "translate", x: 0, y: parseLengthValue(args[0]) });
        break;
      }
      case "scale": {
        const sx = parseFloat(args[0]);
        const sy = args[1] ? parseFloat(args[1]) : sx;
        functions.push({ type: "scale", x: sx, y: sy });
        break;
      }
      case "scaleX": {
        functions.push({ type: "scale", x: parseFloat(args[0]), y: 1 });
        break;
      }
      case "scaleY": {
        functions.push({ type: "scale", x: 1, y: parseFloat(args[0]) });
        break;
      }
      case "rotate": {
        functions.push({ type: "rotate", angle: parseAngleValue(args[0]) });
        break;
      }
      case "skewX": {
        functions.push({ type: "skewX", angle: parseAngleValue(args[0]) });
        break;
      }
      case "skewY": {
        functions.push({ type: "skewY", angle: parseAngleValue(args[0]) });
        break;
      }
    }
  }
  return functions;
}
function parseLengthValue(value) {
  return parseFloat(value) || 0;
}
function parseAngleValue(value) {
  value = value.trim();
  if (value.endsWith("rad")) return parseFloat(value) * 180 / Math.PI;
  if (value.endsWith("turn")) return parseFloat(value) * 360;
  if (value.endsWith("grad")) return parseFloat(value) * 0.9;
  return parseFloat(value) || 0;
}

// src/transforms/matrix.ts
function identity() {
  return [1, 0, 0, 1, 0, 0];
}
function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}
function translate(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}
function scale(sx, sy) {
  return [sx, 0, 0, sy, 0, 0];
}
function rotate(angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, 0, 0];
}
function skewX(angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return [1, 0, Math.tan(rad), 1, 0, 0];
}
function skewY(angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return [1, Math.tan(rad), 0, 1, 0, 0];
}
function isIdentity(m) {
  return Math.abs(m[0] - 1) < 1e-10 && Math.abs(m[1]) < 1e-10 && Math.abs(m[2]) < 1e-10 && Math.abs(m[3] - 1) < 1e-10 && Math.abs(m[4]) < 1e-10 && Math.abs(m[5]) < 1e-10;
}
function toSvgTransform(m) {
  return `matrix(${m.map((v) => v.toFixed(6)).join(",")})`;
}

// src/transforms/svg.ts
function cssTransformToSvg(cssTransform, transformOrigin, box) {
  const functions = parseTransform(cssTransform);
  if (functions.length === 0) return null;
  const [ox, oy] = parseTransformOrigin(transformOrigin, box);
  let result = identity();
  result = multiply(result, translate(ox, oy));
  for (const fn of functions) {
    result = multiply(result, transformFunctionToMatrix(fn));
  }
  result = multiply(result, translate(-ox, -oy));
  if (isIdentity(result)) return null;
  return toSvgTransform(result);
}
function transformFunctionToMatrix(fn) {
  switch (fn.type) {
    case "matrix":
      return fn.values;
    case "translate":
      return translate(fn.x, fn.y);
    case "scale":
      return scale(fn.x, fn.y);
    case "rotate":
      return rotate(fn.angle);
    case "skewX":
      return skewX(fn.angle);
    case "skewY":
      return skewY(fn.angle);
  }
}
function parseTransformOrigin(origin, box) {
  const parts = origin.split(/\s+/);
  const x = parseOriginValue(parts[0] ?? "50%", box.width, box.x);
  const y = parseOriginValue(parts[1] ?? "50%", box.height, box.y);
  return [x, y];
}
function parseOriginValue(value, size, offset) {
  if (value === "left" || value === "top") return offset;
  if (value === "right" || value === "bottom") return offset + size;
  if (value === "center") return offset + size / 2;
  if (value.endsWith("%")) {
    return offset + parseFloat(value) / 100 * size;
  }
  return offset + parseFloat(value);
}

// src/assets/filters.ts
function createSvgFilter(filterValue, ctx) {
  const functions = parseCssFilterFunctions(filterValue);
  if (functions.length === 0) return null;
  const id = ctx.idGenerator.next("filter");
  const filter = createSvgElement(ctx.svgDocument, "filter");
  setAttributes(filter, {
    id,
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  });
  let hasAny = false;
  for (const fn of functions) {
    const primitives = createFilterPrimitives(fn, ctx);
    for (const prim of primitives) {
      filter.appendChild(prim);
      hasAny = true;
    }
  }
  if (!hasAny) return null;
  ctx.defs.appendChild(filter);
  return id;
}
function parseFilterAmount(raw) {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    return (parseFloat(trimmed) || 0) / 100;
  }
  return parseFloat(trimmed) || 0;
}
function parseAngle2(raw) {
  const trimmed = raw.trim();
  if (trimmed.endsWith("rad")) return (parseFloat(trimmed) || 0) * (180 / Math.PI);
  if (trimmed.endsWith("grad")) return (parseFloat(trimmed) || 0) * 0.9;
  if (trimmed.endsWith("turn")) return (parseFloat(trimmed) || 0) * 360;
  return parseFloat(trimmed) || 0;
}
function createFilterPrimitives(fn, ctx) {
  switch (fn.name) {
    case "blur": {
      const radius = parseFloat(fn.args) || 0;
      const blur = createSvgElement(ctx.svgDocument, "feGaussianBlur");
      setAttributes(blur, { stdDeviation: radius });
      return [blur];
    }
    case "brightness": {
      const amount = parseFilterAmount(fn.args);
      return [createComponentTransfer(ctx, { slope: amount })];
    }
    case "contrast": {
      const amount = parseFilterAmount(fn.args);
      const intercept = 0.5 - 0.5 * amount;
      return [createComponentTransfer(ctx, { slope: amount, intercept })];
    }
    case "drop-shadow": {
      const parsed = parseDropShadow(`drop-shadow(${fn.args})`);
      if (!parsed) return [];
      const shadow = createSvgElement(ctx.svgDocument, "feDropShadow");
      setAttributes(shadow, {
        dx: parsed.offsetX,
        dy: parsed.offsetY,
        stdDeviation: parsed.blur / 2,
        "flood-color": parsed.color,
        "flood-opacity": 1
      });
      return [shadow];
    }
    case "grayscale": {
      const amount = parseFilterAmount(fn.args);
      const s = Math.max(0, Math.min(1, 1 - amount));
      const matrix = createSvgElement(ctx.svgDocument, "feColorMatrix");
      setAttributes(matrix, { type: "saturate", values: s });
      return [matrix];
    }
    case "hue-rotate": {
      const degrees = parseAngle2(fn.args);
      const matrix = createSvgElement(ctx.svgDocument, "feColorMatrix");
      setAttributes(matrix, { type: "hueRotate", values: degrees });
      return [matrix];
    }
    case "invert": {
      const amount = parseFilterAmount(fn.args);
      const lo = amount;
      const hi = 1 - amount;
      return [createComponentTransfer(ctx, {
        type: "table",
        tableValues: `${lo} ${hi}`
      })];
    }
    case "opacity": {
      const amount = parseFilterAmount(fn.args);
      const transfer = createSvgElement(ctx.svgDocument, "feComponentTransfer");
      const funcA = createSvgElement(ctx.svgDocument, "feFuncA");
      setAttributes(funcA, { type: "linear", slope: amount, intercept: 0 });
      transfer.appendChild(funcA);
      return [transfer];
    }
    case "saturate": {
      const amount = parseFilterAmount(fn.args);
      const matrix = createSvgElement(ctx.svgDocument, "feColorMatrix");
      setAttributes(matrix, { type: "saturate", values: amount });
      return [matrix];
    }
    case "sepia": {
      const amount = Math.max(0, Math.min(1, parseFilterAmount(fn.args)));
      const a = amount;
      const b = 1 - amount;
      const values = [
        b + a * 0.393,
        a * 0.769,
        a * 0.189,
        0,
        0,
        a * 0.349,
        b + a * 0.686,
        a * 0.168,
        0,
        0,
        a * 0.272,
        a * 0.534,
        b + a * 0.131,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ].map((v) => v.toFixed(4)).join(" ");
      const matrix = createSvgElement(ctx.svgDocument, "feColorMatrix");
      setAttributes(matrix, { type: "matrix", values });
      return [matrix];
    }
    default:
      return [];
  }
}
function createComponentTransfer(ctx, opts) {
  const transfer = createSvgElement(ctx.svgDocument, "feComponentTransfer");
  for (const channel of ["feFuncR", "feFuncG", "feFuncB"]) {
    const func = createSvgElement(ctx.svgDocument, channel);
    if (opts.type === "table" && opts.tableValues) {
      setAttributes(func, { type: "table", tableValues: opts.tableValues });
    } else {
      const attrs = {
        type: "linear",
        slope: opts.slope ?? 1
      };
      if (opts.intercept !== void 0) attrs.intercept = opts.intercept;
      setAttributes(func, attrs);
    }
    transfer.appendChild(func);
  }
  return transfer;
}
function parseCssFilterFunctions(value) {
  const results = [];
  const regex = /([a-z-]+)\(/gi;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const name = match[1];
    const argsStart = match.index + match[0].length;
    let depth = 1;
    let i = argsStart;
    for (; i < value.length && depth > 0; i++) {
      if (value[i] === "(") depth++;
      else if (value[i] === ")") depth--;
    }
    const args = value.slice(argsStart, i - 1).trim();
    results.push({ name: name.toLowerCase(), args });
    regex.lastIndex = i;
  }
  return results;
}
function parseDropShadow(value) {
  const startIdx = value.indexOf("drop-shadow(");
  if (startIdx === -1) return null;
  const argsStart = startIdx + "drop-shadow(".length;
  let depth = 1;
  let argsEnd = argsStart;
  for (let i = argsStart; i < value.length && depth > 0; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    if (depth > 0) argsEnd = i + 1;
  }
  const args = value.slice(argsStart, argsEnd).trim();
  if (!args) return null;
  const parts = [];
  let current = "";
  let parenDepth = 0;
  for (const char of args) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === " " && parenDepth === 0 && current) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  if (parts.length < 2) return null;
  const numericParts = [];
  let color = "rgba(0,0,0,0.3)";
  for (const part of parts) {
    const num = parseFloat(part);
    if (!isNaN(num) && (part.endsWith("px") || part.match(/^-?[\d.]+$/))) {
      numericParts.push(num);
    } else {
      color = part;
    }
  }
  return {
    offsetX: numericParts[0] ?? 0,
    offsetY: numericParts[1] ?? 0,
    blur: numericParts[2] ?? 0,
    color
  };
}

// src/assets/box-shadow.ts
function parseBoxShadows(value) {
  if (!value || value === "none") return [];
  const shadows = [];
  const parts = splitTopLevelCommas(value);
  for (const part of parts) {
    const shadow = parseSingleShadow(part.trim());
    if (shadow) shadows.push(shadow);
  }
  return shadows;
}
function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}
function parseSingleShadow(value) {
  let inset = false;
  let working = value;
  if (working.startsWith("inset ")) {
    inset = true;
    working = working.slice(6).trim();
  } else if (working.endsWith(" inset")) {
    inset = true;
    working = working.slice(0, -6).trim();
  }
  const tokens = [];
  let current = "";
  let depth = 0;
  for (const char of working) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === " " && depth === 0 && current) {
      tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  const numericValues = [];
  const colorParts = [];
  for (const token of tokens) {
    const num = parseFloat(token);
    if (!isNaN(num) && (token.endsWith("px") || token.match(/^-?[\d.]+$/))) {
      numericValues.push(num);
    } else {
      colorParts.push(token);
    }
  }
  if (numericValues.length < 2) return null;
  return {
    inset,
    offsetX: numericValues[0],
    offsetY: numericValues[1],
    blur: numericValues[2] ?? 0,
    spread: numericValues[3] ?? 0,
    color: colorParts.join(" ") || "rgba(0, 0, 0, 0.3)"
  };
}
function renderBoxShadows(shadows, box, radii, ctx, group) {
  for (let i = shadows.length - 1; i >= 0; i--) {
    const shadow = shadows[i];
    if (shadow.inset) {
      renderInsetShadow(shadow, box, radii, ctx, group);
    } else {
      renderOuterShadow(shadow, box, radii, ctx, group);
    }
  }
}
function renderOuterShadow(shadow, box, radii, ctx, group) {
  const spreadBox = {
    x: box.x + shadow.offsetX - shadow.spread,
    y: box.y + shadow.offsetY - shadow.spread,
    width: box.width + shadow.spread * 2,
    height: box.height + shadow.spread * 2
  };
  const spreadRadii = expandRadii(radii, shadow.spread);
  const shape = createShadowShape(spreadBox, spreadRadii, ctx);
  shape.setAttribute("fill", shadow.color);
  if (shadow.blur > 0) {
    const filterId = ctx.idGenerator.next("shadow");
    const filter = createSvgElement(ctx.svgDocument, "filter");
    const margin = shadow.blur * 2 + Math.abs(shadow.offsetX) + Math.abs(shadow.offsetY) + shadow.spread;
    const safeW = Math.max(spreadBox.width, 1);
    const safeH = Math.max(spreadBox.height, 1);
    setAttributes(filter, {
      id: filterId,
      x: `-${(margin / safeW * 100 + 10).toFixed(0)}%`,
      y: `-${(margin / safeH * 100 + 10).toFixed(0)}%`,
      width: `${(200 + margin / safeW * 200 + 20).toFixed(0)}%`,
      height: `${(200 + margin / safeH * 200 + 20).toFixed(0)}%`
    });
    const feGaussianBlur = createSvgElement(ctx.svgDocument, "feGaussianBlur");
    setAttributes(feGaussianBlur, {
      in: "SourceGraphic",
      stdDeviation: shadow.blur / 2
    });
    filter.appendChild(feGaussianBlur);
    ctx.defs.appendChild(filter);
    shape.setAttribute("filter", `url(#${filterId})`);
  }
  group.insertBefore(shape, group.firstChild);
}
function renderInsetShadow(shadow, box, radii, ctx, group) {
  const clipId = ctx.idGenerator.next("inset-clip");
  const clipPath = createSvgElement(ctx.svgDocument, "clipPath");
  clipPath.setAttribute("id", clipId);
  const clipShape = createShadowShape(box, radii, ctx);
  clipPath.appendChild(clipShape);
  ctx.defs.appendChild(clipPath);
  const innerBox = {
    x: box.x + shadow.offsetX + shadow.spread,
    y: box.y + shadow.offsetY + shadow.spread,
    width: Math.max(0, box.width - shadow.spread * 2),
    height: Math.max(0, box.height - shadow.spread * 2)
  };
  const innerRadii = expandRadii(radii, -shadow.spread);
  const g = createSvgElement(ctx.svgDocument, "g");
  g.setAttribute("clip-path", `url(#${clipId})`);
  const outerRect = createSvgElement(ctx.svgDocument, "rect");
  const pad = shadow.blur * 3 + Math.abs(shadow.offsetX) + Math.abs(shadow.offsetY) + 100;
  setAttributes(outerRect, {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
    fill: shadow.color
  });
  const innerShape = createShadowShape(innerBox, innerRadii, ctx);
  innerShape.setAttribute("fill", shadow.color);
  const maskId = ctx.idGenerator.next("inset-mask");
  const mask = createSvgElement(ctx.svgDocument, "mask");
  mask.setAttribute("id", maskId);
  const maskWhite = createSvgElement(ctx.svgDocument, "rect");
  setAttributes(maskWhite, { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2, fill: "white" });
  const maskBlack = createShadowShape(innerBox, innerRadii, ctx);
  maskBlack.setAttribute("fill", "black");
  mask.appendChild(maskWhite);
  mask.appendChild(maskBlack);
  ctx.defs.appendChild(mask);
  outerRect.setAttribute("mask", `url(#${maskId})`);
  if (shadow.blur > 0) {
    const filterId = ctx.idGenerator.next("inset-blur");
    const filter = createSvgElement(ctx.svgDocument, "filter");
    setAttributes(filter, { id: filterId, x: "-50%", y: "-50%", width: "200%", height: "200%" });
    const feBlur = createSvgElement(ctx.svgDocument, "feGaussianBlur");
    setAttributes(feBlur, { in: "SourceGraphic", stdDeviation: shadow.blur / 2 });
    filter.appendChild(feBlur);
    ctx.defs.appendChild(filter);
    outerRect.setAttribute("filter", `url(#${filterId})`);
  }
  g.appendChild(outerRect);
  group.insertBefore(g, group.firstChild);
}
function createShadowShape(box, radii, ctx) {
  if (hasRadius(radii) && !isUniformRadius(radii)) {
    const path = createSvgElement(ctx.svgDocument, "path");
    path.setAttribute("d", buildRoundedRectPath(box.x, box.y, box.width, box.height, radii));
    return path;
  }
  const rect = createSvgElement(ctx.svgDocument, "rect");
  setAttributes(rect, { x: box.x, y: box.y, width: box.width, height: box.height });
  if (hasRadius(radii) && isUniformRadius(radii)) {
    setAttributes(rect, { rx: radii.topLeft[0], ry: radii.topLeft[1] });
  }
  return rect;
}
function expandRadii(radii, amount) {
  return {
    topLeft: [Math.max(0, radii.topLeft[0] + amount), Math.max(0, radii.topLeft[1] + amount)],
    topRight: [Math.max(0, radii.topRight[0] + amount), Math.max(0, radii.topRight[1] + amount)],
    bottomRight: [Math.max(0, radii.bottomRight[0] + amount), Math.max(0, radii.bottomRight[1] + amount)],
    bottomLeft: [Math.max(0, radii.bottomLeft[0] + amount), Math.max(0, radii.bottomLeft[1] + amount)]
  };
}

// src/assets/clip-path.ts
function parseLengthValue2(raw) {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    return { value: parseFloat(trimmed) || 0, isPct: true };
  }
  return { value: parseFloat(trimmed) || 0, isPct: false };
}
function parseClipPath(value) {
  if (!value || value === "none") return null;
  const insetMatch = value.match(/^inset\((.+)\)$/);
  if (insetMatch) return parseInset(insetMatch[1]);
  const circleMatch = value.match(/^circle\((.+)\)$/);
  if (circleMatch) return parseCircle(circleMatch[1]);
  const ellipseMatch = value.match(/^ellipse\((.+)\)$/);
  if (ellipseMatch) return parseEllipse(ellipseMatch[1]);
  const polygonMatch = value.match(/^polygon\((.+)\)$/);
  if (polygonMatch) return parsePolygon(polygonMatch[1]);
  const pathMatch = value.match(/^path\(["']?(.+?)["']?\)$/);
  if (pathMatch) return { type: "path", d: pathMatch[1] };
  return null;
}
function parseInset(args) {
  const roundIdx = args.indexOf(" round ");
  let insetPart = args;
  let round;
  if (roundIdx >= 0) {
    insetPart = args.slice(0, roundIdx);
    round = args.slice(roundIdx + 7).trim();
  }
  const values = insetPart.trim().split(/\s+/).map((v) => parseFloat(v) || 0);
  const top = values[0] ?? 0;
  const right = values[1] ?? top;
  const bottom = values[2] ?? top;
  const left = values[3] ?? right;
  return { type: "inset", top, right, bottom, left, round };
}
function parseCircle(args) {
  const atIdx = args.indexOf(" at ");
  let radius = 0;
  let cx = 0;
  let cy = 0;
  let cxPct = false;
  let cyPct = false;
  if (atIdx >= 0) {
    radius = parseFloat(args.slice(0, atIdx)) || 0;
    const center = args.slice(atIdx + 4).trim().split(/\s+/);
    const cxVal = parseLengthValue2(center[0]);
    const cyVal = parseLengthValue2(center[1]);
    cx = cxVal.value;
    cxPct = cxVal.isPct;
    cy = cyVal.value;
    cyPct = cyVal.isPct;
  } else {
    radius = parseFloat(args) || 0;
    cx = 50;
    cy = 50;
    cxPct = true;
    cyPct = true;
  }
  return { type: "circle", radius, cx, cy, cxPct, cyPct };
}
function parseEllipse(args) {
  const atIdx = args.indexOf(" at ");
  let rx = 0;
  let ry = 0;
  let cx = 0;
  let cy = 0;
  let cxPct = false;
  let cyPct = false;
  if (atIdx >= 0) {
    const radii = args.slice(0, atIdx).trim().split(/\s+/);
    rx = parseFloat(radii[0]) || 0;
    ry = parseFloat(radii[1]) || 0;
    const center = args.slice(atIdx + 4).trim().split(/\s+/);
    const cxVal = parseLengthValue2(center[0]);
    const cyVal = parseLengthValue2(center[1]);
    cx = cxVal.value;
    cxPct = cxVal.isPct;
    cy = cyVal.value;
    cyPct = cyVal.isPct;
  } else {
    const parts = args.trim().split(/\s+/);
    rx = parseFloat(parts[0]) || 0;
    ry = parseFloat(parts[1]) || 0;
    cx = 50;
    cy = 50;
    cxPct = true;
    cyPct = true;
  }
  return { type: "ellipse", rx, ry, cx, cy, cxPct, cyPct };
}
function parsePolygon(args) {
  let cleaned = args.trim();
  if (cleaned.startsWith("nonzero,") || cleaned.startsWith("evenodd,")) {
    cleaned = cleaned.slice(cleaned.indexOf(",") + 1).trim();
  }
  const points = [];
  const pairs = cleaned.split(",");
  for (const pair of pairs) {
    const parts = pair.trim().split(/\s+/);
    if (parts.length >= 2) {
      points.push([parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0]);
    }
  }
  if (points.length < 3) return null;
  return { type: "polygon", points };
}
function createSvgClipPath(shape, box, ctx) {
  const clipId = ctx.idGenerator.next("clip");
  const clipPath = createSvgElement(ctx.svgDocument, "clipPath");
  clipPath.setAttribute("id", clipId);
  const svgShape = shapeToSvg(shape, box, ctx, ctx.compat.inlineClipPathTransforms);
  if (!svgShape) return null;
  clipPath.appendChild(svgShape);
  ctx.defs.appendChild(clipPath);
  return clipId;
}
function translatePathData(d, dx, dy) {
  return d.replace(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g, (_, cmd, args) => {
    const nums = args.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
    if (nums.length === 0) return cmd + args;
    switch (cmd) {
      case "M":
      case "L":
      case "T":
        for (let i = 0; i < nums.length - 1; i += 2) {
          nums[i] += dx;
          nums[i + 1] += dy;
        }
        break;
      case "H":
        for (let i = 0; i < nums.length; i++) nums[i] += dx;
        break;
      case "V":
        for (let i = 0; i < nums.length; i++) nums[i] += dy;
        break;
      case "C":
        for (let i = 0; i < nums.length - 1; i += 2) {
          nums[i] += dx;
          nums[i + 1] += dy;
        }
        break;
      case "S":
      case "Q":
        for (let i = 0; i < nums.length - 1; i += 2) {
          nums[i] += dx;
          nums[i + 1] += dy;
        }
        break;
      case "A":
        for (let i = 0; i < nums.length; i += 7) {
          if (i + 5 < nums.length) nums[i + 5] += dx;
          if (i + 6 < nums.length) nums[i + 6] += dy;
        }
        break;
      // Relative commands (lowercase) — leave unchanged
      default:
        return cmd + args;
    }
    return cmd + nums.join(" ");
  });
}
function shapeToSvg(shape, box, ctx, inlineTransforms = false) {
  switch (shape.type) {
    case "inset": {
      const x = box.x + shape.left;
      const y = box.y + shape.top;
      const w = Math.max(0, box.width - shape.left - shape.right);
      const h = Math.max(0, box.height - shape.top - shape.bottom);
      if (shape.round) {
        const radiiValues = shape.round.split("/").map(
          (part) => part.trim().split(/\s+/).map((v) => parseFloat(v) || 0)
        );
        const h_values = radiiValues[0] ?? [0];
        const v_values = radiiValues[1] ?? h_values;
        const radii = {
          topLeft: [h_values[0] ?? 0, v_values[0] ?? 0],
          topRight: [h_values[1] ?? h_values[0] ?? 0, v_values[1] ?? v_values[0] ?? 0],
          bottomRight: [h_values[2] ?? h_values[0] ?? 0, v_values[2] ?? v_values[0] ?? 0],
          bottomLeft: [h_values[3] ?? h_values[1] ?? h_values[0] ?? 0, v_values[3] ?? v_values[1] ?? v_values[0] ?? 0]
        };
        const path = createSvgElement(ctx.svgDocument, "path");
        path.setAttribute("d", buildRoundedRectPath(x, y, w, h, radii));
        return path;
      }
      const rect = createSvgElement(ctx.svgDocument, "rect");
      setAttributes(rect, { x, y, width: w, height: h });
      return rect;
    }
    case "circle": {
      const resolvedCx = shape.cxPct ? shape.cx / 100 * box.width : shape.cx;
      const resolvedCy = shape.cyPct ? shape.cy / 100 * box.height : shape.cy;
      const circle = createSvgElement(ctx.svgDocument, "circle");
      setAttributes(circle, {
        cx: box.x + resolvedCx,
        cy: box.y + resolvedCy,
        r: shape.radius
      });
      return circle;
    }
    case "ellipse": {
      const resolvedCx = shape.cxPct ? shape.cx / 100 * box.width : shape.cx;
      const resolvedCy = shape.cyPct ? shape.cy / 100 * box.height : shape.cy;
      const ellipse = createSvgElement(ctx.svgDocument, "ellipse");
      setAttributes(ellipse, {
        cx: box.x + resolvedCx,
        cy: box.y + resolvedCy,
        rx: shape.rx,
        ry: shape.ry
      });
      return ellipse;
    }
    case "polygon": {
      const polygon = createSvgElement(ctx.svgDocument, "polygon");
      const pointsStr = shape.points.map(([x, y]) => `${box.x + x},${box.y + y}`).join(" ");
      polygon.setAttribute("points", pointsStr);
      return polygon;
    }
    case "path": {
      const path = createSvgElement(ctx.svgDocument, "path");
      if (inlineTransforms && (box.x !== 0 || box.y !== 0)) {
        path.setAttribute("d", translatePathData(shape.d, box.x, box.y));
      } else {
        path.setAttribute("d", shape.d);
        path.setAttribute("transform", `translate(${box.x}, ${box.y})`);
      }
      return path;
    }
    default:
      return null;
  }
}

// src/renderers/html-element.ts
async function renderHtmlElement(element, rootElement, ctx) {
  const group = createSvgElement(ctx.svgDocument, "g");
  const styles = window.getComputedStyle(element);
  let box = getRelativeBox(element, rootElement);
  let visualTransform = null;
  if (ctx.options.flattenTransforms && styles.transform && styles.transform !== "none") {
    const angle = extractRotationDeg(styles.transform);
    if (Math.abs(angle) > 0.5) {
      const el = element;
      const preW = el.offsetWidth;
      const preH = el.offsetHeight;
      if (preW > 0 && preH > 0 && (Math.abs(preW - box.width) > 1 || Math.abs(preH - box.height) > 1)) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        box = {
          x: cx - preW / 2,
          y: cy - preH / 2,
          width: preW,
          height: preH
        };
        visualTransform = `rotate(${angle.toFixed(2)}, ${cx.toFixed(2)}, ${cy.toFixed(2)})`;
      }
    }
  }
  const radii = clampRadii(parseBorderRadii(styles), box.width, box.height);
  if (!ctx.options.flattenTransforms && styles.transform && styles.transform !== "none") {
    const svgTransform = cssTransformToSvg(
      styles.transform,
      styles.transformOrigin,
      box
    );
    if (svgTransform) {
      group.setAttribute("transform", svgTransform);
    }
  }
  const clipPathValue = styles.clipPath;
  if (clipPathValue && clipPathValue !== "none") {
    const shape = parseClipPath(clipPathValue);
    if (shape) {
      const clipId = createSvgClipPath(shape, box, ctx);
      if (clipId) group.setAttribute("clip-path", `url(#${clipId})`);
    }
  }
  const hidden = isVisibilityHidden(styles);
  if (!hidden) {
    if (!ctx.compat.stripFilters && styles.filter && styles.filter !== "none") {
      const filterId = createSvgFilter(styles.filter, ctx);
      if (filterId) {
        group.setAttribute("filter", `url(#${filterId})`);
      }
    }
    if (!ctx.compat.stripBoxShadows) {
      const boxShadowValue = styles.boxShadow;
      if (boxShadowValue && boxShadowValue !== "none") {
        const shadows = parseBoxShadows(boxShadowValue);
        if (shadows.length > 0) {
          renderBoxShadows(shadows, box, radii, ctx, group);
        }
      }
    }
    const bgColor = parseBackgroundColor(styles);
    if (bgColor) {
      const rect = createBoxShape(box, radii, ctx);
      rect.setAttribute("fill", bgColor);
      group.appendChild(rect);
    }
    if (hasBackgroundImage(styles)) {
      await renderBackgroundImages(styles, box, radii, ctx, group);
    }
    const borders = parseBorders(styles);
    if (hasBorder(borders)) {
      renderBorders(group, box, borders, radii, ctx);
    }
    renderOutline(styles, box, radii, ctx, group);
    if (isImageElement(element) && element.src) {
      const dataUrl = await imageToDataUrl(element.src);
      const imgEl = createSvgElement(ctx.svgDocument, "image");
      setAttributes(imgEl, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        href: dataUrl
      });
      const objectFit = styles.objectFit || element.style.objectFit;
      if (objectFit === "fill" || objectFit === "") {
        imgEl.setAttribute("preserveAspectRatio", "none");
      } else if (objectFit === "contain" || objectFit === "scale-down") {
        imgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      } else if (objectFit === "cover") {
        imgEl.setAttribute("preserveAspectRatio", "xMidYMid slice");
      }
      if (hasRadius(radii)) {
        const clipId = ctx.idGenerator.next("clip");
        const clipPath = createSvgElement(ctx.svgDocument, "clipPath");
        clipPath.setAttribute("id", clipId);
        const clipShape = createSvgElement(ctx.svgDocument, "path");
        clipShape.setAttribute("d", buildRoundedRectPath(box.x, box.y, box.width, box.height, radii));
        clipPath.appendChild(clipShape);
        ctx.defs.appendChild(clipPath);
        imgEl.setAttribute("clip-path", `url(#${clipId})`);
      }
      group.appendChild(imgEl);
    }
    if (isCanvasElement(element)) {
      const dataUrl = canvasToDataUrl(element);
      if (dataUrl) {
        const imgEl = createSvgElement(ctx.svgDocument, "image");
        setAttributes(imgEl, {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          href: dataUrl
        });
        group.appendChild(imgEl);
      }
    }
    if (isFormElement(element)) {
      renderFormContent(element, styles, box, ctx, group);
    }
    if (styles.display === "list-item") {
      renderListMarker(element, styles, box, ctx, group);
    }
    if (!ctx.compat.stripMaskImage) {
      const maskImage = styles.webkitMaskImage || styles.maskImage || styles.webkitMask || styles.mask;
      if (maskImage && maskImage !== "none") {
        await applyMaskImage(maskImage, styles, box, ctx, group);
      }
    }
    await renderPseudoElement(element, "::before", rootElement, ctx, group);
  }
  if (visualTransform) {
    const visualGroup = createSvgElement(ctx.svgDocument, "g");
    visualGroup.setAttribute("transform", visualTransform);
    while (group.firstChild) {
      visualGroup.appendChild(group.firstChild);
    }
    group.appendChild(visualGroup);
  }
  if (hasOverflowClip(styles) && element !== rootElement) {
    const clipGroup = ctx.compat.useClipPathForOverflow ? createOverflowClipPath(box, radii, ctx) : createOverflowMask(box, radii, ctx);
    group.appendChild(clipGroup);
    group.__childTarget = clipGroup;
  }
  return group;
}
async function renderPseudoAfter(element, rootElement, ctx, group) {
  await renderPseudoElement(element, "::after", rootElement, ctx, group);
}
function getChildTarget(group) {
  return group.__childTarget ?? group;
}
function createBoxShape(box, radii, ctx) {
  if (hasRadius(radii) && !isUniformRadius(radii)) {
    return createRoundedRectPath(box, radii, ctx);
  }
  const rect = createSvgElement(ctx.svgDocument, "rect");
  setAttributes(rect, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height
  });
  if (hasRadius(radii) && isUniformRadius(radii)) {
    setAttributes(rect, {
      rx: radii.topLeft[0],
      ry: radii.topLeft[1]
    });
  }
  return rect;
}
function createRoundedRectPath(box, radii, ctx) {
  const path = createSvgElement(ctx.svgDocument, "path");
  path.setAttribute("d", buildRoundedRectPath(box.x, box.y, box.width, box.height, radii));
  return path;
}
function borderDashArray(style, width) {
  if (style === "dashed") return `${width * 3} ${width * 2}`;
  if (style === "dotted") return `${width} ${width}`;
  return null;
}
function renderBorders(group, box, borders, radii, ctx) {
  if (borders.top.width === borders.right.width && borders.right.width === borders.bottom.width && borders.bottom.width === borders.left.width && borders.top.color === borders.right.color && borders.right.color === borders.bottom.color && borders.bottom.color === borders.left.color && borders.top.style === borders.right.style && borders.right.style === borders.bottom.style && borders.bottom.style === borders.left.style && borders.top.width > 0 && borders.top.style !== "none") {
    const halfW = borders.top.width / 2;
    const insetBox = {
      x: box.x + halfW,
      y: box.y + halfW,
      width: Math.max(0, box.width - borders.top.width),
      height: Math.max(0, box.height - borders.top.width)
    };
    const insetRadii = {
      topLeft: [Math.max(0, radii.topLeft[0] - halfW), Math.max(0, radii.topLeft[1] - halfW)],
      topRight: [Math.max(0, radii.topRight[0] - halfW), Math.max(0, radii.topRight[1] - halfW)],
      bottomRight: [Math.max(0, radii.bottomRight[0] - halfW), Math.max(0, radii.bottomRight[1] - halfW)],
      bottomLeft: [Math.max(0, radii.bottomLeft[0] - halfW), Math.max(0, radii.bottomLeft[1] - halfW)]
    };
    const shape = createBoxShape(insetBox, insetRadii, ctx);
    setAttributes(shape, {
      fill: "none",
      stroke: borders.top.color,
      "stroke-width": borders.top.width
    });
    const dash = borderDashArray(borders.top.style, borders.top.width);
    if (dash) shape.setAttribute("stroke-dasharray", dash);
    group.appendChild(shape);
    return;
  }
  const { x, y, width, height } = box;
  const bT = borders.top.width;
  const bR = borders.right.width;
  const bB = borders.bottom.width;
  const bL = borders.left.width;
  const ox0 = x, oy0 = y;
  const ox1 = x + width, oy1 = y + height;
  const ix0 = x + bL, iy0 = y + bT;
  const ix1 = x + width - bR, iy1 = y + height - bB;
  const sides = [
    { w: bT, side: borders.top, trapD: `M ${ox0} ${oy0} L ${ox1} ${oy0} L ${ix1} ${iy0} L ${ix0} ${iy0} Z`, lineD: `M ${ix0} ${oy0 + bT / 2} L ${ix1} ${oy0 + bT / 2}` },
    { w: bR, side: borders.right, trapD: `M ${ox1} ${oy0} L ${ox1} ${oy1} L ${ix1} ${iy1} L ${ix1} ${iy0} Z`, lineD: `M ${ox1 - bR / 2} ${iy0} L ${ox1 - bR / 2} ${iy1}` },
    { w: bB, side: borders.bottom, trapD: `M ${ox1} ${oy1} L ${ox0} ${oy1} L ${ix0} ${iy1} L ${ix1} ${iy1} Z`, lineD: `M ${ix1} ${oy1 - bB / 2} L ${ix0} ${oy1 - bB / 2}` },
    { w: bL, side: borders.left, trapD: `M ${ox0} ${oy1} L ${ox0} ${oy0} L ${ix0} ${iy0} L ${ix0} ${iy1} Z`, lineD: `M ${ox0 + bL / 2} ${iy1} L ${ox0 + bL / 2} ${iy0}` }
  ];
  for (const { w, side, trapD, lineD } of sides) {
    if (w <= 0 || side.style === "none") continue;
    const dash = borderDashArray(side.style, w);
    if (dash) {
      const line = createSvgElement(ctx.svgDocument, "path");
      setAttributes(line, { d: lineD, fill: "none", stroke: side.color, "stroke-width": w });
      line.setAttribute("stroke-dasharray", dash);
      group.appendChild(line);
    } else {
      const path = createSvgElement(ctx.svgDocument, "path");
      path.setAttribute("d", trapD);
      path.setAttribute("fill", side.color);
      group.appendChild(path);
    }
  }
}
function createOverflowMask(box, radii, ctx) {
  const maskId = ctx.idGenerator.next("mask");
  const mask = createSvgElement(ctx.svgDocument, "mask");
  mask.setAttribute("id", maskId);
  const maskRect = createBoxShape(box, radii, ctx);
  maskRect.setAttribute("fill", "white");
  mask.appendChild(maskRect);
  ctx.defs.appendChild(mask);
  const masked = createSvgElement(ctx.svgDocument, "g");
  masked.setAttribute("mask", `url(#${maskId})`);
  return masked;
}
function createOverflowClipPath(box, radii, ctx) {
  const clipId = ctx.idGenerator.next("clip");
  const clipPath = createSvgElement(ctx.svgDocument, "clipPath");
  clipPath.setAttribute("id", clipId);
  const clipShape = createBoxShape(box, radii, ctx);
  clipPath.appendChild(clipShape);
  ctx.defs.appendChild(clipPath);
  const clipped = createSvgElement(ctx.svgDocument, "g");
  clipped.setAttribute("clip-path", `url(#${clipId})`);
  return clipped;
}
function applyClipMask(target, box, radii, ctx, group) {
  const maskId = ctx.idGenerator.next("mask");
  const mask = createSvgElement(ctx.svgDocument, "mask");
  mask.setAttribute("id", maskId);
  const maskRect = createBoxShape(box, radii, ctx);
  maskRect.setAttribute("fill", "white");
  mask.appendChild(maskRect);
  ctx.defs.appendChild(mask);
  const wrapper = createSvgElement(ctx.svgDocument, "g");
  wrapper.setAttribute("mask", `url(#${maskId})`);
  wrapper.appendChild(target);
  group.appendChild(wrapper);
}
async function applyMaskImage(maskImage, styles, box, ctx, group) {
  const url = extractUrlFromCss(maskImage);
  if (!url) return;
  let imageUrl = url;
  if (!url.startsWith("data:")) {
    try {
      imageUrl = await imageToDataUrl(url);
    } catch {
      return;
    }
  }
  const maskSize = styles.webkitMaskSize || styles.maskSize || "auto";
  let imgWidth = box.width;
  let imgHeight = box.height;
  if (maskSize !== "auto" && maskSize !== "contain" && maskSize !== "cover") {
    const parts = maskSize.split(/\s+/);
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1] || parts[0]);
    if (!isNaN(w)) imgWidth = w;
    if (!isNaN(h)) imgHeight = h;
  }
  const maskId = ctx.idGenerator.next("mask");
  const mask = createSvgElement(ctx.svgDocument, "mask");
  mask.setAttribute("id", maskId);
  if (!ctx.compat.avoidStyleAttributes) {
    mask.setAttribute("style", "mask-type: alpha");
  }
  const imgEl = createSvgElement(ctx.svgDocument, "image");
  setAttributes(imgEl, {
    x: box.x,
    y: box.y,
    width: imgWidth,
    height: imgHeight,
    href: imageUrl
  });
  mask.appendChild(imgEl);
  ctx.defs.appendChild(mask);
  group.setAttribute("mask", `url(#${maskId})`);
}
function renderListMarker(element, styles, box, ctx, group) {
  let markerText = "";
  try {
    const markerStyles = window.getComputedStyle(element, "::marker");
    const content = markerStyles.content;
    if (content && content !== "none" && content !== "normal") {
      markerText = content.replace(/^["']|["']$/g, "");
    }
  } catch {
  }
  if (!markerText) {
    const listStyleType = styles.listStyleType;
    if (listStyleType === "none") return;
    if (listStyleType === "disc") {
      markerText = "\u2022";
    } else if (listStyleType === "circle") {
      markerText = "\u25CB";
    } else if (listStyleType === "square") {
      markerText = "\u25A0";
    } else if (listStyleType === "decimal" || listStyleType === "" || !listStyleType) {
      let count = 1;
      let sibling = element.previousElementSibling;
      while (sibling) {
        const sibStyles = window.getComputedStyle(sibling);
        if (sibStyles.display === "list-item") count++;
        sibling = sibling.previousElementSibling;
      }
      markerText = `${count}.`;
    } else {
      markerText = "\u2022";
    }
  }
  if (!markerText) return;
  const fontSize = parseFloat(styles.fontSize) || 16;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;
  const markerX = box.x + paddingLeft - 6;
  const markerY = box.y + paddingTop + (lineHeight - fontSize) / 2 + fontSize * 0.8;
  const textEl = createSvgElement(ctx.svgDocument, "text");
  setAttributes(textEl, {
    x: markerX.toFixed(2),
    y: markerY.toFixed(2),
    "font-family": styles.fontFamily,
    "font-size": styles.fontSize,
    fill: styles.color,
    "text-anchor": "end"
  });
  textEl.textContent = markerText;
  group.appendChild(textEl);
}
function renderFormContent(element, styles, box, ctx, group) {
  let text = "";
  let isPlaceholder = false;
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0];
    text = selected?.text ?? "";
  } else {
    text = element.value;
    if (!text && element.placeholder) {
      text = element.placeholder;
      isPlaceholder = true;
    }
  }
  if (!text) return;
  const fontSize = parseFloat(styles.fontSize) || 16;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const borderTop = parseFloat(styles.borderTopWidth) || 0;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;
  const fillColor = isPlaceholder ? "gray" : styles.color;
  const textX = box.x + paddingLeft;
  if (element instanceof HTMLTextAreaElement) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) continue;
      const topPadding = (lineHeight - fontSize) / 2;
      const y = box.y + borderTop + paddingTop + i * lineHeight + topPadding + fontSize * 0.8;
      const textEl2 = createSvgElement(ctx.svgDocument, "text");
      setAttributes(textEl2, {
        x: textX.toFixed(2),
        y: y.toFixed(2),
        "font-family": styles.fontFamily,
        "font-size": styles.fontSize,
        "font-weight": styles.fontWeight,
        "font-style": styles.fontStyle,
        fill: fillColor
      });
      if (isPlaceholder) textEl2.setAttribute("opacity", "0.54");
      textEl2.textContent = lineText;
      group.appendChild(textEl2);
    }
    return;
  }
  const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
  const innerHeight = box.height - borderTop - borderBottom;
  const baselineY2 = box.y + borderTop + innerHeight / 2 + fontSize * 0.35;
  const textEl = createSvgElement(ctx.svgDocument, "text");
  setAttributes(textEl, {
    x: textX.toFixed(2),
    y: baselineY2.toFixed(2),
    "font-family": styles.fontFamily,
    "font-size": styles.fontSize,
    "font-weight": styles.fontWeight,
    "font-style": styles.fontStyle,
    fill: fillColor
  });
  if (isPlaceholder) {
    textEl.setAttribute("opacity", "0.54");
  }
  textEl.textContent = text;
  group.appendChild(textEl);
}
function renderOutline(styles, box, radii, ctx, group) {
  const outlineStyle = styles.outlineStyle;
  if (!outlineStyle || outlineStyle === "none") return;
  const outlineWidth = parseFloat(styles.outlineWidth) || 0;
  if (outlineWidth <= 0) return;
  const outlineColor = styles.outlineColor || styles.color;
  const outlineOffset = parseFloat(styles.outlineOffset) || 0;
  const expand = outlineOffset + outlineWidth / 2;
  const outlineBox = {
    x: box.x - expand,
    y: box.y - expand,
    width: box.width + expand * 2,
    height: box.height + expand * 2
  };
  const outlineRadii = {
    topLeft: [Math.max(0, radii.topLeft[0] + expand), Math.max(0, radii.topLeft[1] + expand)],
    topRight: [Math.max(0, radii.topRight[0] + expand), Math.max(0, radii.topRight[1] + expand)],
    bottomRight: [Math.max(0, radii.bottomRight[0] + expand), Math.max(0, radii.bottomRight[1] + expand)],
    bottomLeft: [Math.max(0, radii.bottomLeft[0] + expand), Math.max(0, radii.bottomLeft[1] + expand)]
  };
  const shape = createBoxShape(outlineBox, outlineRadii, ctx);
  setAttributes(shape, {
    fill: "none",
    stroke: outlineColor,
    "stroke-width": outlineWidth
  });
  const dash = borderDashArray(outlineStyle, outlineWidth);
  if (dash) shape.setAttribute("stroke-dasharray", dash);
  group.appendChild(shape);
}
function splitCssValueList(str) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
function computeBackgroundPlacement(bgSize, bgPosition, box) {
  let width = box.width;
  let height = box.height;
  let par = "none";
  if (bgSize === "contain") {
    par = "xMidYMid meet";
  } else if (bgSize === "cover") {
    par = "xMidYMid slice";
  } else if (bgSize && bgSize !== "auto") {
    const sizeParts = bgSize.split(/\s+/);
    const w = parseBgDimension(sizeParts[0], box.width);
    const h = parseBgDimension(sizeParts[1] ?? "auto", box.height);
    if (w !== null) width = w;
    if (h !== null) height = h;
  }
  let x = box.x;
  let y = box.y;
  if (bgPosition && bgPosition !== "0% 0%") {
    const posParts = bgPosition.split(/\s+/);
    x = box.x + parseBgOffset(posParts[0] ?? "0px", box.width, width);
    y = box.y + parseBgOffset(posParts[1] ?? "0px", box.height, height);
  }
  return { x, y, width, height, preserveAspectRatio: par };
}
function parseBgDimension(value, containerSize) {
  if (value === "auto") return null;
  if (value.endsWith("%")) return parseFloat(value) / 100 * containerSize;
  return parseFloat(value) || null;
}
function parseBgOffset(value, containerSize, imageSize) {
  if (value.endsWith("%")) {
    const pct = parseFloat(value) / 100;
    return pct * (containerSize - imageSize);
  }
  return parseFloat(value) || 0;
}
async function renderBackgroundImages(styles, box, radii, ctx, group) {
  const bgImages = splitCssValueList(styles.backgroundImage);
  const bgSizes = splitCssValueList(styles.backgroundSize);
  const bgPositions = splitCssValueList(styles.backgroundPosition);
  for (let i = bgImages.length - 1; i >= 0; i--) {
    const bgImage = bgImages[i];
    if (bgImage === "none") continue;
    const bgSize = bgSizes[i] ?? bgSizes[bgSizes.length - 1] ?? "auto";
    const bgPosition = bgPositions[i] ?? bgPositions[bgPositions.length - 1] ?? "0% 0%";
    const placement = computeBackgroundPlacement(bgSize, bgPosition, box);
    await renderSingleBackgroundLayer(bgImage, placement, box, radii, ctx, group);
  }
}
async function renderSingleBackgroundLayer(bgImage, placement, box, radii, ctx, group) {
  const gradient = parseLinearGradient(bgImage);
  if (gradient) {
    const gradientEl = createSvgLinearGradient(gradient, box, ctx);
    const rect = createBoxShape(box, radii, ctx);
    rect.setAttribute("fill", `url(#${gradientEl.getAttribute("id")})`);
    group.appendChild(rect);
    return;
  }
  const rasterized = rasterizeGradient(bgImage, placement.width, placement.height);
  if (rasterized) {
    const imgEl = createSvgElement(ctx.svgDocument, "image");
    setAttributes(imgEl, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      href: rasterized,
      preserveAspectRatio: placement.preserveAspectRatio
    });
    if (hasRadius(radii)) {
      applyClipMask(imgEl, box, radii, ctx, group);
    } else {
      group.appendChild(imgEl);
    }
    return;
  }
  const url = extractUrlFromCss(bgImage);
  if (url) {
    const dataUrl = await imageToDataUrl(url);
    const imgEl = createSvgElement(ctx.svgDocument, "image");
    setAttributes(imgEl, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      href: dataUrl,
      preserveAspectRatio: placement.preserveAspectRatio
    });
    if (hasRadius(radii)) {
      applyClipMask(imgEl, box, radii, ctx, group);
    } else {
      group.appendChild(imgEl);
    }
  }
}
function hasVisualProperties(styles) {
  if (parseBackgroundColor(styles)) return true;
  if (hasBackgroundImage(styles)) return true;
  const clipPath = styles.clipPath || styles.webkitClipPath;
  if (clipPath && clipPath !== "none") return true;
  return false;
}
function measurePseudoBox(element, pseudo, styles, rootElement) {
  const marker = document.createElement("span");
  marker.style.cssText = `
    position: ${styles.position};
    display: ${styles.display === "none" ? "none" : styles.display};
    top: ${styles.top}; right: ${styles.right};
    bottom: ${styles.bottom}; left: ${styles.left};
    width: ${styles.width}; height: ${styles.height};
    margin: ${styles.margin}; padding: ${styles.padding};
    box-sizing: ${styles.boxSizing};
    visibility: hidden;
    pointer-events: none;
  `;
  if (pseudo === "::before") {
    element.insertBefore(marker, element.firstChild);
  } else {
    element.appendChild(marker);
  }
  const rect = marker.getBoundingClientRect();
  element.removeChild(marker);
  if (rect.width === 0 && rect.height === 0) return null;
  const rootRect = rootElement.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: rect.width,
    height: rect.height
  };
}
async function renderPseudoElement(element, pseudo, rootElement, ctx, group) {
  const styles = getPseudoStyles(element, pseudo);
  const content = styles.content;
  if (!content || content === "none" || content === "normal") {
    return;
  }
  const text = content.replace(/^["']|["']$/g, "");
  const hasVisuals = hasVisualProperties(styles);
  if (!text && !hasVisuals) return;
  if (hasVisuals) {
    const pseudoBox = measurePseudoBox(element, pseudo, styles, rootElement);
    if (pseudoBox) {
      const bgColor = parseBackgroundColor(styles);
      if (bgColor) {
        const rect = createSvgElement(ctx.svgDocument, "rect");
        setAttributes(rect, {
          x: pseudoBox.x,
          y: pseudoBox.y,
          width: pseudoBox.width,
          height: pseudoBox.height,
          fill: bgColor
        });
        const clipPathValue = styles.clipPath || styles.webkitClipPath;
        if (clipPathValue && clipPathValue !== "none") {
          const shape = parseClipPath(clipPathValue);
          if (shape) {
            const clipId = createSvgClipPath(shape, pseudoBox, ctx);
            if (clipId) rect.setAttribute("clip-path", `url(#${clipId})`);
          }
        }
        group.appendChild(rect);
      }
    }
  }
  if (!text) return;
  const rootRect = rootElement.getBoundingClientRect();
  const fontSize = parseFloat(styles.fontSize) || 16;
  const marker = document.createElement("span");
  marker.style.cssText = `
    font-family: ${styles.fontFamily};
    font-size: ${styles.fontSize};
    font-weight: ${styles.fontWeight};
    font-style: ${styles.fontStyle};
    letter-spacing: ${styles.letterSpacing};
    visibility: hidden;
    pointer-events: none;
  `;
  marker.textContent = text;
  if (pseudo === "::before") {
    element.insertBefore(marker, element.firstChild);
  } else {
    element.appendChild(marker);
  }
  const markerRect = marker.getBoundingClientRect();
  const markerX = markerRect.left - rootRect.left;
  const markerWidth = markerRect.width;
  const markerHeight = markerRect.height;
  const topPadding = (markerHeight - fontSize) / 2;
  const baselineY2 = markerRect.top - rootRect.top + topPadding + fontSize * 0.8;
  element.removeChild(marker);
  if (!hasVisuals) {
    const bgColor = parseBackgroundColor(styles);
    if (bgColor) {
      const bgRect = createSvgElement(ctx.svgDocument, "rect");
      setAttributes(bgRect, {
        x: markerX,
        y: markerRect.top - rootRect.top,
        width: markerWidth,
        height: markerHeight,
        fill: bgColor
      });
      group.appendChild(bgRect);
    }
  }
  const textEl = createSvgElement(ctx.svgDocument, "text");
  setAttributes(textEl, {
    "font-family": styles.fontFamily,
    "font-size": styles.fontSize,
    "font-weight": styles.fontWeight,
    "font-style": styles.fontStyle,
    fill: styles.color,
    x: markerX.toFixed(2),
    y: baselineY2.toFixed(2)
  });
  if (styles.letterSpacing && styles.letterSpacing !== "normal") {
    textEl.setAttribute("letter-spacing", styles.letterSpacing);
  }
  textEl.textContent = text;
  group.appendChild(textEl);
}
function extractRotationDeg(transform) {
  const match = transform.match(/^matrix\(([^,]+),\s*([^,]+)/);
  if (!match) return 0;
  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.atan2(b, a) * (180 / Math.PI);
}

// src/renderers/svg-element.ts
function renderSvgElement(element, ctx) {
  const computedColor = window.getComputedStyle(element).color || "rgb(0, 0, 0)";
  const clone = cloneWithNamespace(element, ctx);
  resolveCurrentColor(clone, computedColor);
  rewriteIds(clone, ctx);
  return clone;
}
function cloneWithNamespace(node, ctx, resolveDepth = 0) {
  if (node.localName === "use" && resolveDepth < 5) {
    const resolved = resolveUseElement(node, ctx, resolveDepth);
    if (resolved) return resolved;
  }
  const flattenSvg = ctx.compat.flattenNestedSvg && node.localName === "svg" && node.ownerSVGElement !== null && !node.getAttribute("viewBox");
  const clone = ctx.svgDocument.createElementNS(
    node.namespaceURI || SVG_NS,
    flattenSvg ? "g" : node.localName
  );
  const stripStyle = ctx.compat.avoidStyleAttributes;
  const svgGeomAttrs = /* @__PURE__ */ new Set(["x", "y", "width", "height", "overflow", "viewBox"]);
  for (const attr of Array.from(node.attributes)) {
    if (stripStyle && (attr.localName === "style" || attr.localName === "class")) {
      continue;
    }
    if (flattenSvg && svgGeomAttrs.has(attr.localName)) {
      continue;
    }
    if (attr.namespaceURI === XLINK_NS) {
      clone.setAttributeNS(XLINK_NS, attr.localName, attr.value);
    } else if (attr.namespaceURI) {
      clone.setAttributeNS(attr.namespaceURI, attr.localName, attr.value);
    } else {
      clone.setAttribute(attr.localName, attr.value);
    }
  }
  if (flattenSvg) {
    const x = parseFloat(node.getAttribute("x") || "0") || 0;
    const y = parseFloat(node.getAttribute("y") || "0") || 0;
    if (x !== 0 || y !== 0) {
      clone.setAttribute("transform", `translate(${x},${y})`);
    }
  }
  inlineSvgPresentationStyles(node, clone, ctx);
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      clone.appendChild(cloneWithNamespace(child, ctx, resolveDepth));
    } else if (child.nodeType === Node.TEXT_NODE) {
      clone.appendChild(ctx.svgDocument.createTextNode(child.textContent || ""));
    }
  }
  return clone;
}
function resolveUseElement(useEl, ctx, resolveDepth) {
  const href = useEl.getAttribute("href") || useEl.getAttributeNS(XLINK_NS, "href");
  if (!href || !href.startsWith("#")) return null;
  const refId = href.slice(1);
  const refEl = document.getElementById(refId);
  if (!refEl) return null;
  const group = ctx.svgDocument.createElementNS(SVG_NS, "g");
  const skipAttrs = /* @__PURE__ */ new Set(["href", "xlink:href", "x", "y", "width", "height"]);
  for (const attr of Array.from(useEl.attributes)) {
    if (skipAttrs.has(attr.localName)) continue;
    if (attr.namespaceURI === XLINK_NS) continue;
    if (attr.namespaceURI) {
      group.setAttributeNS(attr.namespaceURI, attr.localName, attr.value);
    } else {
      group.setAttribute(attr.localName, attr.value);
    }
  }
  const x = parseFloat(useEl.getAttribute("x") || "0") || 0;
  const y = parseFloat(useEl.getAttribute("y") || "0") || 0;
  if (x !== 0 || y !== 0) {
    const existing = group.getAttribute("transform") || "";
    group.setAttribute("transform", `translate(${x},${y}) ${existing}`.trim());
  }
  inlineSvgPresentationStyles(useEl, group, ctx);
  if (refEl.localName === "symbol") {
    const viewBox = refEl.getAttribute("viewBox");
    const width = useEl.getAttribute("width") || refEl.getAttribute("width");
    const height = useEl.getAttribute("height") || refEl.getAttribute("height");
    const wrapper = ctx.svgDocument.createElementNS(SVG_NS, "svg");
    if (viewBox) wrapper.setAttribute("viewBox", viewBox);
    if (width) wrapper.setAttribute("width", width);
    if (height) wrapper.setAttribute("height", height);
    wrapper.setAttribute("overflow", "hidden");
    for (const child of Array.from(refEl.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        wrapper.appendChild(cloneWithNamespace(child, ctx, resolveDepth + 1));
      }
    }
    group.appendChild(wrapper);
  } else {
    group.appendChild(cloneWithNamespace(refEl, ctx, resolveDepth + 1));
  }
  return group;
}
function inlineSvgPresentationStyles(source, clone, ctx) {
  const styles = window.getComputedStyle(source);
  if (!clone.hasAttribute("fill")) {
    const fill = styles.fill;
    if (fill && fill !== "rgb(0, 0, 0)") {
      clone.setAttribute("fill", fill);
    }
  }
  if (!clone.hasAttribute("stroke")) {
    const stroke = styles.stroke;
    if (stroke && stroke !== "none") {
      clone.setAttribute("stroke", stroke);
    }
  }
  if (!clone.hasAttribute("opacity")) {
    const opacity = styles.opacity;
    if (opacity === "0") {
      clone.setAttribute("opacity", "0");
    } else if (!ctx.compat.stripGroupOpacity && opacity && opacity !== "1") {
      clone.setAttribute("opacity", opacity);
    }
  }
}
function rewriteIds(root, ctx) {
  const idMap = /* @__PURE__ */ new Map();
  const allElements = root.querySelectorAll("[id]");
  for (const el of Array.from(allElements)) {
    const oldId = el.getAttribute("id");
    const newId = ctx.idGenerator.next("svg");
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  }
  if (root.hasAttribute("id")) {
    const oldId = root.getAttribute("id");
    if (!idMap.has(oldId)) {
      const newId = ctx.idGenerator.next("svg");
      idMap.set(oldId, newId);
      root.setAttribute("id", newId);
    }
  }
  if (idMap.size === 0) return;
  rewriteUrlReferences(root, idMap);
}
function rewriteUrlReferences(element, idMap) {
  for (const attr of Array.from(element.attributes)) {
    if (attr.value.includes("url(#")) {
      let newValue = attr.value;
      for (const [oldId, newId] of idMap) {
        newValue = newValue.replace(
          new RegExp(`url\\(#${escapeRegex(oldId)}\\)`, "g"),
          `url(#${newId})`
        );
      }
      if (newValue !== attr.value) {
        element.setAttribute(attr.localName, newValue);
      }
    }
    if ((attr.localName === "href" || attr.localName === "xlink:href") && attr.value.startsWith("#")) {
      const refId = attr.value.slice(1);
      if (idMap.has(refId)) {
        if (attr.namespaceURI === XLINK_NS) {
          element.setAttributeNS(XLINK_NS, "href", `#${idMap.get(refId)}`);
        } else {
          element.setAttribute(attr.localName, `#${idMap.get(refId)}`);
        }
      }
    }
  }
  for (const child of Array.from(element.children)) {
    if (child instanceof SVGElement) {
      rewriteUrlReferences(child, idMap);
    }
  }
}
function resolveCurrentColor(element, color) {
  for (const attr of Array.from(element.attributes)) {
    if (attr.value === "currentColor") {
      element.setAttribute(attr.localName, color);
    }
  }
  for (const child of Array.from(element.children)) {
    if (child instanceof SVGElement) {
      resolveCurrentColor(child, color);
    }
  }
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/assets/fonts.ts
var FONT_TIMEOUT_MS = 1e4;
function createFontCache(mapping) {
  const cache = /* @__PURE__ */ new Map();
  let opentypeModule = null;
  async function loadOpentype() {
    if (opentypeModule) return opentypeModule;
    opentypeModule = await import("opentype.js");
    return opentypeModule;
  }
  function getKey(family, weight, style) {
    return `${family}|${weight ?? "normal"}|${style ?? "normal"}`;
  }
  function normalizeWeight(w) {
    if (w === void 0 || w === "normal") return 400;
    if (w === "bold") return 700;
    return typeof w === "string" ? parseInt(w, 10) || 400 : w;
  }
  function normalizeStyle(s) {
    return s === "italic" || s === "oblique" ? "italic" : "normal";
  }
  function findConfig(family, weight, style) {
    const entry = mapping[family];
    if (!entry) return null;
    if (typeof entry === "string") {
      return { url: entry };
    }
    if (!Array.isArray(entry)) {
      return entry;
    }
    const targetWeight = normalizeWeight(weight);
    const targetStyle = normalizeStyle(style);
    let best = null;
    let bestScore = -1;
    for (const cfg of entry) {
      let score = 0;
      if (normalizeStyle(cfg.style) === targetStyle) score += 2;
      if (normalizeWeight(cfg.weight) === targetWeight) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = cfg;
      }
    }
    return best ?? entry[0] ?? null;
  }
  return {
    async getFont(family, weight, style) {
      const key = getKey(family, weight, style);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const config = findConfig(family, weight, style);
      if (!config) return null;
      const opentype = await loadOpentype();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FONT_TIMEOUT_MS);
        const response = await fetch(config.url, { signal: controller.signal });
        clearTimeout(timer);
        const buffer = await response.arrayBuffer();
        const font = opentype.parse(buffer);
        cache.set(key, font);
        return font;
      } catch (err) {
        console.warn(`dom2svg: Failed to load font "${family}" from ${config.url}:`, err);
        return null;
      }
    },
    has(family) {
      return family in mapping;
    }
  };
}
function textToPath(font, text, x, y, fontSize) {
  try {
    const path = font.getPath(text, x, y, fontSize);
    return path.toPathData(2);
  } catch {
    return null;
  }
}
function cleanFontFamily(fontFamily) {
  const first = fontFamily.split(",")[0]?.trim() ?? fontFamily;
  return first.replace(/^["']|["']$/g, "");
}

// src/assets/text-shadow.ts
function parseTextShadows(value) {
  if (!value || value === "none") return [];
  const shadows = [];
  const parts = splitTopLevelCommas2(value);
  for (const part of parts) {
    const shadow = parseSingleTextShadow(part.trim());
    if (shadow) shadows.push(shadow);
  }
  return shadows;
}
function splitTopLevelCommas2(str) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}
function parseSingleTextShadow(value) {
  const tokens = [];
  let current = "";
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === " " && depth === 0 && current) {
      tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  const numericValues = [];
  const colorParts = [];
  for (const token of tokens) {
    const num = parseFloat(token);
    if (!isNaN(num) && (token.endsWith("px") || token.match(/^-?[\d.]+$/))) {
      numericValues.push(num);
    } else {
      colorParts.push(token);
    }
  }
  if (numericValues.length < 2) return null;
  return {
    offsetX: numericValues[0],
    offsetY: numericValues[1],
    blur: numericValues[2] ?? 0,
    color: colorParts.join(" ") || "rgba(0, 0, 0, 0.5)"
  };
}
function createTextShadowFilter(shadows, ctx) {
  if (shadows.length === 0) return null;
  const id = ctx.idGenerator.next("tshadow");
  const filter = createSvgElement(ctx.svgDocument, "filter");
  setAttributes(filter, {
    id,
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  });
  if (shadows.length === 1) {
    const s = shadows[0];
    const feDrop = createSvgElement(ctx.svgDocument, "feDropShadow");
    setAttributes(feDrop, {
      dx: s.offsetX,
      dy: s.offsetY,
      stdDeviation: s.blur / 2,
      "flood-color": s.color,
      "flood-opacity": 1
    });
    filter.appendChild(feDrop);
  } else {
    const mergeInputs = [];
    for (let i = 0; i < shadows.length; i++) {
      const s = shadows[i];
      const suffix = String(i);
      const feOffset = createSvgElement(ctx.svgDocument, "feOffset");
      setAttributes(feOffset, {
        in: "SourceAlpha",
        dx: s.offsetX,
        dy: s.offsetY,
        result: `off${suffix}`
      });
      filter.appendChild(feOffset);
      const feBlur = createSvgElement(ctx.svgDocument, "feGaussianBlur");
      setAttributes(feBlur, {
        in: `off${suffix}`,
        stdDeviation: s.blur / 2,
        result: `blur${suffix}`
      });
      filter.appendChild(feBlur);
      const feFlood = createSvgElement(ctx.svgDocument, "feFlood");
      setAttributes(feFlood, {
        "flood-color": s.color,
        "flood-opacity": 1,
        result: `color${suffix}`
      });
      filter.appendChild(feFlood);
      const feComp = createSvgElement(ctx.svgDocument, "feComposite");
      setAttributes(feComp, {
        in: `color${suffix}`,
        in2: `blur${suffix}`,
        operator: "in",
        result: `shadow${suffix}`
      });
      filter.appendChild(feComp);
      mergeInputs.push(`shadow${suffix}`);
    }
    const feMerge = createSvgElement(ctx.svgDocument, "feMerge");
    for (const input of mergeInputs) {
      const node = createSvgElement(ctx.svgDocument, "feMergeNode");
      node.setAttribute("in", input);
      feMerge.appendChild(node);
    }
    const srcNode = createSvgElement(ctx.svgDocument, "feMergeNode");
    srcNode.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(srcNode);
    filter.appendChild(feMerge);
  }
  ctx.defs.appendChild(filter);
  return id;
}

// src/renderers/text-node.ts
async function renderTextNode(textNode, rootElement, ctx) {
  const text = textNode.textContent;
  if (!text || !text.trim()) return null;
  const parent = textNode.parentElement;
  if (!parent) return null;
  const styles = window.getComputedStyle(parent);
  if (styles.visibility === "hidden") return null;
  const whiteSpace = styles.whiteSpace;
  const rootRect = rootElement.getBoundingClientRect();
  let rects;
  try {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    rects = range.getClientRects();
  } catch {
    return null;
  }
  if (rects.length === 0) return null;
  const group = createSvgElement(ctx.svgDocument, "g");
  const usePathMode = ctx.options.textToPath && ctx.fontCache;
  const fontFamily = cleanFontFamily(styles.fontFamily);
  const fontSize = parseFloat(styles.fontSize) || 16;
  const fontWeight = styles.fontWeight;
  const fontStyle = styles.fontStyle;
  let font = null;
  if (usePathMode && ctx.fontCache?.has(fontFamily)) {
    font = await ctx.fontCache.getFont(fontFamily, fontWeight, fontStyle);
  }
  let ascenderRatio = 0.8;
  if (font && font.ascender && font.unitsPerEm) {
    ascenderRatio = font.ascender / font.unitsPerEm;
  }
  const lines = getTextLines(textNode, rootRect, ascenderRatio, whiteSpace);
  const textTransform = styles.textTransform;
  const needsEllipsis = styles.textOverflow === "ellipsis" && styles.overflow !== "visible" && styles.whiteSpace === "nowrap" && parent.scrollWidth > parent.clientWidth;
  for (const line of lines) {
    let displayText = applyTextTransform(line.text, textTransform);
    if (needsEllipsis && line === lines[lines.length - 1]) {
      displayText = displayText.trimEnd() + "\u2026";
    }
    if (font) {
      const pathData = textToPath(font, displayText, line.x, line.y, fontSize);
      if (pathData) {
        const pathEl = createSvgElement(ctx.svgDocument, "path");
        setAttributes(pathEl, {
          d: pathData,
          fill: styles.color
        });
        group.appendChild(pathEl);
      }
    } else {
      const textEl = createSvgElement(ctx.svgDocument, "text");
      setAttributes(textEl, {
        x: line.x.toFixed(2),
        y: line.y.toFixed(2)
      });
      applyTextStyles(textEl, styles, ctx);
      textEl.textContent = displayText;
      group.appendChild(textEl);
    }
  }
  if (group.childNodes.length === 0) return null;
  if (!ctx.compat.stripTextShadows) {
    const textShadowValue = styles.textShadow;
    if (textShadowValue && textShadowValue !== "none") {
      const shadows = parseTextShadows(textShadowValue);
      const filterId = createTextShadowFilter(shadows, ctx);
      if (filterId) {
        group.setAttribute("filter", `url(#${filterId})`);
      }
    }
  }
  return group;
}
function baselineY(rectTop, rectHeight, fontSize, rootTop, ascenderRatio = 0.8, parentRect) {
  let effectiveTop = rectTop;
  let effectiveHeight = rectHeight;
  if (parentRect && rectHeight > fontSize * 2 && parentRect.height < rectHeight * 0.8) {
    effectiveTop = parentRect.top;
    effectiveHeight = parentRect.height;
  }
  const topPadding = (effectiveHeight - fontSize) / 2;
  return effectiveTop - rootTop + topPadding + fontSize * ascenderRatio;
}
function getTextLines(textNode, rootRect, ascenderRatio = 0.8, whiteSpace = "normal") {
  const lines = [];
  const text = textNode.textContent || "";
  if (!text) return lines;
  const parent = textNode.parentElement;
  if (!parent) return lines;
  const styles = window.getComputedStyle(parent);
  const fontSize = parseFloat(styles.fontSize) || 16;
  const pRect = parent.getBoundingClientRect();
  const parentRect = { top: pRect.top, height: pRect.height };
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rects = range.getClientRects();
  if (rects.length === 0) return lines;
  let lineRects;
  if (rects.length === 1) {
    const rect = rects[0];
    if (text.length > 1 && textActuallyWraps(textNode, range, text.length, fontSize)) {
      lineRects = discoverLineRects(textNode, range, text.length, fontSize);
    } else {
      lines.push({
        text: normalizeWhitespace(text, whiteSpace),
        x: rect.left - rootRect.left,
        y: baselineY(rect.top, rect.height, fontSize, rootRect.top, ascenderRatio, parentRect)
      });
      return lines;
    }
  } else {
    lineRects = Array.from(rects);
  }
  let charStart = 0;
  for (let lineIdx = 0; lineIdx < lineRects.length; lineIdx++) {
    const lineRect = lineRects[lineIdx];
    const isLastLine = lineIdx === lineRects.length - 1;
    let charEnd;
    if (isLastLine) {
      charEnd = text.length;
    } else {
      const currentTop = lineRect.top;
      charEnd = binarySearchLineBreak(textNode, range, charStart, text.length, currentTop, fontSize);
    }
    const lineText = normalizeWhitespace(text.slice(charStart, charEnd), whiteSpace);
    if (lineText) {
      lines.push({
        text: lineText,
        x: lineRect.left - rootRect.left,
        y: baselineY(lineRect.top, lineRect.height, fontSize, rootRect.top, ascenderRatio, parentRect)
      });
    }
    charStart = charEnd;
  }
  return lines;
}
function binarySearchLineBreak(textNode, range, start, end, currentLineTop, fontSize) {
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    try {
      range.setStart(textNode, mid);
      range.setEnd(textNode, mid + 1);
    } catch {
      start = mid + 1;
      continue;
    }
    const rects = range.getClientRects();
    if (rects.length === 0) {
      start = mid + 1;
      continue;
    }
    if (Math.abs(rects[0].top - currentLineTop) > fontSize * 0.5) {
      end = mid;
    } else {
      start = mid + 1;
    }
  }
  return start;
}
function textActuallyWraps(textNode, range, textLength, fontSize) {
  if (textLength <= 1) return false;
  try {
    range.setStart(textNode, 0);
    range.setEnd(textNode, 1);
    const firstRects = range.getClientRects();
    range.setStart(textNode, textLength - 1);
    range.setEnd(textNode, textLength);
    const lastRects = range.getClientRects();
    if (firstRects.length > 0 && lastRects.length > 0) {
      return Math.abs(lastRects[0].top - firstRects[0].top) > fontSize * 0.5;
    }
  } catch {
  }
  return false;
}
function discoverLineRects(textNode, range, textLength, fontSize) {
  const lineRects = [];
  let currentLineTop = -Infinity;
  for (let i = 0; i < textLength; i++) {
    try {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const charRects = range.getClientRects();
      if (charRects.length === 0) continue;
      const charRect = charRects[0];
      if (Math.abs(charRect.top - currentLineTop) > fontSize * 0.5) {
        lineRects.push(charRect);
        currentLineTop = charRect.top;
      }
    } catch {
      continue;
    }
  }
  return lineRects;
}
function normalizeWhitespace(text, whiteSpace) {
  const preserves = whiteSpace === "pre" || whiteSpace === "pre-wrap" || whiteSpace === "break-spaces";
  if (preserves) return text;
  if (whiteSpace === "pre-line") {
    return text.replace(/[^\S\n]+/g, " ");
  }
  return text.replace(/\s+/g, " ");
}
function applyTextTransform(text, transform) {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}
function applyTextStyles(textEl, styles, ctx) {
  setAttributes(textEl, {
    "font-family": styles.fontFamily,
    "font-size": styles.fontSize,
    "font-weight": styles.fontWeight,
    "font-style": styles.fontStyle,
    fill: styles.color
  });
  if (!ctx.compat.stripXmlSpace) {
    textEl.setAttribute("xml:space", "preserve");
  }
  if (styles.letterSpacing && styles.letterSpacing !== "normal") {
    textEl.setAttribute("letter-spacing", styles.letterSpacing);
  }
  if (styles.wordSpacing && styles.wordSpacing !== "normal") {
    textEl.setAttribute("word-spacing", styles.wordSpacing);
  }
  if (styles.textDecoration && styles.textDecoration !== "none") {
    const decs = [];
    if (styles.textDecoration.includes("underline")) decs.push("underline");
    if (styles.textDecoration.includes("line-through")) decs.push("line-through");
    if (decs.length > 0) {
      textEl.setAttribute("text-decoration", decs.join(" "));
    }
  }
}

// src/core/traversal.ts
async function walkElement(element, rootElement, ctx) {
  const styles = window.getComputedStyle(element);
  if (isInvisible(styles)) return null;
  if (shouldExclude(element, ctx)) return null;
  if (ctx.options.handler) {
    try {
      const result = ctx.options.handler(element, ctx);
      if (result !== null) return result;
    } catch (err) {
      console.warn("dom2svg: Custom handler threw for element:", element, err);
    }
  }
  if (isSvgElement(element) && element !== rootElement) {
    const box = getRelativeBox(element, rootElement);
    const clone = renderSvgElement(element, ctx);
    if (element.tagName.toLowerCase() === "svg") {
      clone.setAttribute("x", String(box.x));
      clone.setAttribute("y", String(box.y));
      clone.setAttribute("width", String(box.width));
      clone.setAttribute("height", String(box.height));
      if (styles.overflow === "visible") {
        clone.setAttribute("overflow", "visible");
      }
    }
    return clone;
  }
  const group = await renderHtmlElement(element, rootElement, ctx);
  const childTarget = getChildTarget(group);
  {
    const opacity = parseFloat(styles.opacity);
    if (opacity === 0) {
      group.setAttribute("opacity", "0");
    } else if (!ctx.compat.stripGroupOpacity && opacity < 1) {
      group.setAttribute("opacity", String(opacity));
    }
  }
  const sortedChildren = sortChildrenByPaintOrder(element);
  for (const child of sortedChildren) {
    if (isTextNode(child)) {
      const textSvg = await renderTextNode(child, rootElement, ctx);
      if (textSvg) childTarget.appendChild(textSvg);
    } else if (isElement(child)) {
      const childSvg = await walkElement(child, rootElement, ctx);
      if (childSvg) childTarget.appendChild(childSvg);
    }
  }
  await renderPseudoAfter(element, rootElement, ctx, group);
  return group;
}
function sortChildrenByPaintOrder(element) {
  const children = Array.from(element.childNodes);
  if (!children.some((c) => isElement(c))) return children;
  const negativeZIndex = [];
  const blocks = [];
  const floats = [];
  const inlinesAndText = [];
  const positioned = [];
  const positiveZIndex = [];
  for (const child of children) {
    if (isTextNode(child)) {
      inlinesAndText.push(child);
      continue;
    }
    if (!isElement(child)) continue;
    const childStyles = window.getComputedStyle(child);
    const z = getZIndex(childStyles);
    const hasStackingCtx = createsStackingContext(childStyles);
    const pos = isPositioned(childStyles);
    if (hasStackingCtx && z < 0) {
      negativeZIndex.push({ node: child, z });
    } else if (hasStackingCtx && z > 0) {
      positiveZIndex.push({ node: child, z });
    } else if (pos || hasStackingCtx) {
      positioned.push(child);
    } else if (isFloat(childStyles)) {
      floats.push(child);
    } else if (isInlineLevel(childStyles)) {
      inlinesAndText.push(child);
    } else {
      blocks.push(child);
    }
  }
  negativeZIndex.sort((a, b) => a.z - b.z);
  positiveZIndex.sort((a, b) => a.z - b.z);
  const result = [];
  for (const { node } of negativeZIndex) result.push(node);
  for (const node of blocks) result.push(node);
  for (const node of floats) result.push(node);
  for (const node of inlinesAndText) result.push(node);
  for (const node of positioned) result.push(node);
  for (const { node } of positiveZIndex) result.push(node);
  return result;
}
function shouldExclude(element, ctx) {
  const exclude = ctx.options.exclude;
  if (!exclude) return false;
  if (typeof exclude === "string") {
    return element.matches(exclude);
  }
  return exclude(element);
}

// src/compat.ts
var FULL_PRESET = {
  useClipPathForOverflow: false,
  stripFilters: false,
  stripBoxShadows: false,
  stripMaskImage: false,
  stripTextShadows: false,
  avoidStyleAttributes: false,
  stripXmlSpace: false,
  stripGroupOpacity: false,
  inlineClipPathTransforms: false,
  flattenNestedSvg: false
};
var INKSCAPE_PRESET = {
  useClipPathForOverflow: true,
  stripFilters: true,
  stripBoxShadows: true,
  stripMaskImage: true,
  stripTextShadows: true,
  avoidStyleAttributes: true,
  stripXmlSpace: true,
  stripGroupOpacity: true,
  inlineClipPathTransforms: true,
  flattenNestedSvg: true
};
function resolveCompat(compat) {
  if (!compat || compat === "full") return FULL_PRESET;
  if (compat === "inkscape") return INKSCAPE_PRESET;
  return compat;
}

// src/index.ts
async function domToSvg(element, options = {}) {
  const padding = options.padding ?? 0;
  const rect = element.getBoundingClientRect();
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;
  const svgDocument = document.implementation.createDocument(SVG_NS, "svg", null);
  const svg = svgDocument.documentElement;
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttributeNS(XMLNS_NS, "xmlns:xlink", "http://www.w3.org/1999/xlink");
  setAttributes(svg, {
    width,
    height,
    viewBox: `${-padding} ${-padding} ${width} ${height}`
  });
  const defs = createSvgElement(svgDocument, "defs");
  svg.appendChild(defs);
  if (options.background) {
    const bgRect = createSvgElement(svgDocument, "rect");
    setAttributes(bgRect, {
      x: -padding,
      y: -padding,
      width,
      height,
      fill: options.background
    });
    svg.appendChild(bgRect);
  }
  const ctx = {
    svgDocument,
    defs,
    idGenerator: createIdGenerator(),
    options,
    compat: resolveCompat(options.compat),
    opacity: 1
  };
  if (options.textToPath && options.fonts) {
    ctx.fontCache = createFontCache(options.fonts);
  }
  const rootGroup = await walkElement(element, element, ctx);
  if (rootGroup) {
    const rootStyles = window.getComputedStyle(element);
    const rootRadii = clampRadii(parseBorderRadii(rootStyles), rect.width, rect.height);
    if (hasOverflowClip(rootStyles) && hasRadius(rootRadii)) {
      const clipId = ctx.idGenerator.next("clip");
      const clipPath = createSvgElement(svgDocument, "clipPath");
      clipPath.setAttribute("id", clipId);
      const clipShape = createRootClipShape(svgDocument, rect.width, rect.height, rootRadii);
      clipPath.appendChild(clipShape);
      defs.appendChild(clipPath);
      rootGroup.setAttribute("clip-path", `url(#${clipId})`);
    }
    svg.appendChild(rootGroup);
  }
  if (defs.childNodes.length === 0) {
    svg.removeChild(defs);
  }
  return createResult(svg);
}
function createRootClipShape(doc, width, height, radii) {
  if (isUniformRadius(radii)) {
    const rect = createSvgElement(doc, "rect");
    setAttributes(rect, { x: 0, y: 0, width, height, rx: radii.topLeft[0], ry: radii.topLeft[1] });
    return rect;
  }
  const path = createSvgElement(doc, "path");
  path.setAttribute("d", buildRoundedRectPath(0, 0, width, height, radii));
  return path;
}
function createResult(svg) {
  return {
    svg,
    toString() {
      const serializer = new XMLSerializer();
      const xmlStr = serializer.serializeToString(svg);
      return `<?xml version="1.0" encoding="UTF-8"?>
${xmlStr}`;
    },
    toBlob() {
      const str = this.toString();
      return new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    },
    download(filename = "export.svg") {
      const blob = this.toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 6e4);
    }
  };
}
export {
  domToSvg
};
//# sourceMappingURL=index.js.map