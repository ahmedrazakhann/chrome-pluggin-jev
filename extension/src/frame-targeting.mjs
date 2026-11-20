function originOf(url) {
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

export function normalizeFramePolicy(raw = null) {
  if (!raw) {
    return {
      strategy: "top",
      allowAllFrames: false,
      expectedMatches: 1,
      targets: [],
      onMismatch: "needs_review",
    };
  }
  const strategy = raw.strategy || "top";
  if (!["top", "exact", "all"].includes(strategy)) {
    throw new Error("invalid frame policy strategy");
  }
  if (typeof raw.allowAllFrames !== "boolean") {
    throw new Error("invalid allowAllFrames frame policy value");
  }
  if (strategy === "all" && !raw.allowAllFrames) {
    throw new Error("all-frame scanning was not authorized");
  }
  const expectedMatches = Number(raw.expectedMatches ?? 1);
  if (!Number.isInteger(expectedMatches) || expectedMatches < 1 || expectedMatches > 20) {
    throw new Error("invalid expectedMatches frame policy value");
  }
  const targets = Array.isArray(raw.targets) ? raw.targets.map(target => ({
    origin: String(target.origin || "").replace(/\/$/, ""),
    pathPrefix: target.pathPrefix ? String(target.pathPrefix) : null,
    label: target.label ? String(target.label) : null,
  })) : [];
  if (strategy === "exact" && (!targets.length || targets.some(target => !target.origin))) {
    throw new Error("exact frame policy requires target origins");
  }
  return {
    strategy,
    allowAllFrames: raw.allowAllFrames,
    expectedMatches,
    targets,
    onMismatch: "needs_review",
  };
}
export function selectFrames(frames, rawPolicy = null) {
  const policy = normalizeFramePolicy(rawPolicy);
  const inventory = (Array.isArray(frames) ? frames : [])
    .filter(frame => Number.isInteger(frame.frameId))
    .map(frame => ({
      frameId: frame.frameId,
      parentFrameId: frame.parentFrameId,
      documentId: typeof frame.documentId === "string" ? frame.documentId : "",
      url: typeof frame.url === "string" ? frame.url : "",
      origin: originOf(frame.url),
    }))
    .sort((left, right) => left.frameId - right.frameId);

  let selected;
  if (policy.strategy === "top") {
    selected = inventory.filter(frame => frame.frameId === 0);
  } else if (policy.strategy === "all") {
    selected = inventory.filter(frame => frame.origin);
  } else {
    selected = inventory.filter(frame => policy.targets.some(target => {
      if (frame.origin !== target.origin) return false;
      if (!target.pathPrefix) return true;
      try {
        return new URL(frame.url).pathname.startsWith(target.pathPrefix);
      } catch {
        return false;
      }
    }));
  }
  const status = selected.length === policy.expectedMatches ? "matched" : "mismatch";
  return {
    inventory,
    selected: status === "matched" ? selected : [],
    frameOrigins: [...new Set(inventory.map(frame => frame.origin).filter(Boolean))],
    policy: {
      strategy: policy.strategy,
      allowAllFrames: policy.allowAllFrames,
      expectedMatches: policy.expectedMatches,
      matchedCount: selected.length,
      status,
      onMismatch: policy.onMismatch,
    },
  };
}
