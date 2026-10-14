"use client";

import { createContext, useContext } from "react";

import type { AppVersion } from "@/lib/types";

/** Prototype version (V1 / V2) for components deep in the tree: markers, tooltips, cards. */
export const VersionContext = createContext<AppVersion>("v2");
export const useVersion = () => useContext(VersionContext);
