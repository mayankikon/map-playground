"use client";

import { createContext, useContext } from "react";

import type { AppVersion, Asset } from "@/lib/types";

/** Prototype version (V1 / V2) for components deep in the tree: markers, tooltips, cards. */
export const VersionContext = createContext<AppVersion>("v2");
export const useVersion = () => useContext(VersionContext);

/** Vehicles by id, so key tooltips anywhere on the map can name the paired vehicle. */
export const VehicleLookupContext = createContext<Map<string, Asset>>(new Map());
export const useVehicleLookup = () => useContext(VehicleLookupContext);
