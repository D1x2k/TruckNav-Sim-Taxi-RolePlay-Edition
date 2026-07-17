import { ref, watch, computed } from "vue";
import { convertEts2ToGeo, convertAtsToGeo, convertGeoToEts2, convertGeoToAts } from "~/assets/utils/map/converters";
import { useGraphSystem } from "~/composables/GraphSystem";

export enum TaxiStatus {
    OFFLINE = "OFFLINE",
    SEARCHING = "SEARCHING",
    OFFERING = "OFFERING",
    EN_ROUTE_PICKUP = "EN_ROUTE_PICKUP",
    WAITING_PASSENGER = "WAITING_PASSENGER",
    EN_ROUTE_DROPOFF = "EN_ROUTE_DROPOFF",
    COMPLETED = "COMPLETED",
}

export interface TaxiOrder {
    rawPointA: [number, number]; // [x, z]
    rawPointB: [number, number]; // [x, z]
    geoPointA: [number, number]; // [lng, lat]
    geoPointB: [number, number]; // [lng, lat]
    price: number;
    distanceTotal: number;
}

export function useTaxiSystem() {
    const status = useState<TaxiStatus>("taxi-status", () => TaxiStatus.OFFLINE);
    const earnings = useState<number>("taxi-earnings", () => 0);
    const currentOrder = useState<TaxiOrder | null>("taxi-current-order", () => null);
    const waitingTime = useState<number>("taxi-waiting-time", () => 0);
    const distanceToTarget = useState<number>("taxi-distance-target", () => 0);
    const currentTripDistance = useState<number>("taxi-trip-distance", () => 0);
    const currentTripCost = useState<number>("taxi-trip-cost", () => 0);
    const lastTickCoords = useState<[number, number] | null>("taxi-last-coords", () => null);

    const { rawGameCoords, truckSpeed } = useEtsTelemetry();
    const { settings, activeSettings } = useSettings();
    const { getClosestNodes, nodeCoords, adjacency } = useGraphSystem();

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    let waitTimer: ReturnType<typeof setInterval> | null = null;

    const pricePerKm = 2; // $2 per in-game kilometer

    const getScale = () => settings.value.selectedGame === "ets2" ? 19 : 20;

    const calculateDistance = (p1: [number, number], p2: [number, number]) => {
        const rawDist = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
        return rawDist * getScale();
    };

    const goOnline = () => {
        status.value = TaxiStatus.SEARCHING;
        
        // Mock finding an order after 5-10s
        const waitTime = Math.floor(Math.random() * 5000) + 5000;
        searchTimer = setTimeout(() => {
            generateOrder();
        }, waitTime);
    };

    const goOffline = () => {
        status.value = TaxiStatus.OFFLINE;
        currentOrder.value = null;
        if (searchTimer) clearTimeout(searchTimer);
        if (waitTimer) clearInterval(waitTimer);
    };

    const findReachableNode = (startRaw: [number, number], minRadius: number, maxRadius: number): [number, number] | null => {
        const startGeo = settings.value.selectedGame === "ets2" 
            ? convertEts2ToGeo(startRaw[0], startRaw[1]) 
            : convertAtsToGeo(startRaw[0], startRaw[1]);
            
        const startNodes = getClosestNodes(startGeo, 10, 0.2);
        if (startNodes.length === 0) return null;
        
        const rawDlcs = activeSettings.value.ownedDlcs;
        const ownedDlcs = Array.isArray(rawDlcs) && rawDlcs.length > 0 
            ? rawDlcs 
            : Array.from({ length: 15 }, (_, i) => i + 1);
        
        const targetAngle = Math.random() * Math.PI * 2;
        const targetDist = minRadius + Math.random() * (maxRadius - minRadius);
        const scale = getScale();
        const targetDistMiniature = targetDist / scale;
        
        const targetRaw: [number, number] = [
            startRaw[0] + Math.cos(targetAngle) * targetDistMiniature,
            startRaw[1] + Math.sin(targetAngle) * targetDistMiniature
        ];
        
        let globalFurthestId: number = startNodes[0];
        let globalMaxDist = 0;
        
        for (const startNodeId of startNodes) {
            const stack: number[] = [startNodeId];
            const visited = new Set<number>();
            visited.add(startNodeId);
            
            let bestId: number | null = null;
            let furthestId: number = startNodeId;
            let maxDistSeen = 0;
            let iterations = 0;
            
            while (stack.length > 0 && iterations < 50000) {
                iterations++;
                const currId = stack.pop()!;
                
                const currGeo = nodeCoords.get(currId);
                if (!currGeo) continue;
                
                const currRaw = settings.value.selectedGame === "ets2"
                    ? convertGeoToEts2(currGeo[0], currGeo[1])
                    : convertGeoToAts(currGeo[0], currGeo[1]);
                    
                const distFromStart = calculateDistance(startRaw, currRaw);
                
                if (distFromStart > maxDistSeen) {
                    maxDistSeen = distFromStart;
                    furthestId = currId;
                }
                
                if (distFromStart >= targetDist && distFromStart <= maxRadius + 5000) {
                    bestId = currId;
                    break; 
                }
                
                if (distFromStart > maxRadius + 5000) {
                    continue; 
                }
                
                const neighbors = adjacency.get(currId);
                if (!neighbors) continue;
                
                const validNeighbors = [];
                for (const edge of neighbors) {
                    if (visited.has(edge.to)) continue;
                    if (edge.requiredDlc > 0 && !ownedDlcs.includes(edge.requiredDlc)) continue;
                    
                    const geo = nodeCoords.get(edge.to);
                    if (!geo) continue;
                    
                    const raw = settings.value.selectedGame === "ets2"
                        ? convertGeoToEts2(geo[0], geo[1])
                        : convertGeoToAts(geo[0], geo[1]);
                        
                    const distToTarget = calculateDistance(raw, targetRaw);
                    validNeighbors.push({ edge, distToTarget });
                }
                
                validNeighbors.sort((a, b) => b.distToTarget - a.distToTarget);
                
                for (const vn of validNeighbors) {
                    visited.add(vn.edge.to);
                    stack.push(vn.edge.to);
                }
            }
            
            if (bestId !== null) {
                const chosenGeo = nodeCoords.get(bestId);
                if (chosenGeo) {
                    return settings.value.selectedGame === "ets2"
                        ? convertGeoToEts2(chosenGeo[0], chosenGeo[1])
                        : convertGeoToAts(chosenGeo[0], chosenGeo[1]);
                }
            }
            
            if (maxDistSeen > globalMaxDist) {
                globalMaxDist = maxDistSeen;
                globalFurthestId = furthestId;
            }
        }
        
        const chosenGeo = nodeCoords.get(globalFurthestId);
        if (chosenGeo) {
            return settings.value.selectedGame === "ets2"
                ? convertGeoToEts2(chosenGeo[0], chosenGeo[1])
                : convertGeoToAts(chosenGeo[0], chosenGeo[1]);
        }
        return null;
    };

    const generateOrder = () => {
        if (!rawGameCoords.value) return;

        let rawPointA = findReachableNode(rawGameCoords.value, 2000, 6000);
        if (!rawPointA) {
            const distA = Math.random() * 4000 + 2000;
            const angleA = Math.random() * Math.PI * 2;
            const scale = getScale();
            rawPointA = [
                rawGameCoords.value[0] + Math.cos(angleA) * (distA / scale),
                rawGameCoords.value[1] + Math.sin(angleA) * (distA / scale)
            ];
        }

        let rawPointB = findReachableNode(rawPointA, 20000, 80000);
        if (!rawPointB) {
            const distB = Math.random() * 60000 + 20000;
            const angleB = Math.random() * Math.PI * 2;
            const scale = getScale();
            rawPointB = [
                rawPointA[0] + Math.cos(angleB) * (distB / scale),
                rawPointA[1] + Math.sin(angleB) * (distB / scale)
            ];
        }

        const geoPointA = settings.value.selectedGame === "ets2" 
            ? convertEts2ToGeo(rawPointA[0], rawPointA[1]) 
            : convertAtsToGeo(rawPointA[0], rawPointA[1]);
            
        const geoPointB = settings.value.selectedGame === "ets2" 
            ? convertEts2ToGeo(rawPointB[0], rawPointB[1]) 
            : convertAtsToGeo(rawPointB[0], rawPointB[1]);

        const finalDistB = calculateDistance(rawPointA, rawPointB);
        const price = Math.round((finalDistB / 1000) * pricePerKm);

        currentOrder.value = {
            rawPointA,
            rawPointB,
            geoPointA,
            geoPointB,
            price,
            distanceTotal: finalDistB
        };
        
        status.value = TaxiStatus.OFFERING;
    };

    const acceptOrder = () => {
        status.value = TaxiStatus.EN_ROUTE_PICKUP;
    };

    const rejectOrder = () => {
        currentOrder.value = null;
        goOnline(); // search again
    };

    const arriveAtPickup = () => {
        status.value = TaxiStatus.WAITING_PASSENGER;
        waitingTime.value = 0;
        waitTimer = setInterval(() => {
            waitingTime.value++;
        }, 1000);
    };

    const startTrip = () => {
        if (status.value !== TaxiStatus.WAITING_PASSENGER) return;
        
        status.value = TaxiStatus.EN_ROUTE_DROPOFF;
        currentTripCost.value = currentOrder.value?.price || 0; // Just store fixed price for legacy reference
    };

    const completeTrip = () => {
        if (status.value !== TaxiStatus.EN_ROUTE_DROPOFF) return;
        
        earnings.value += currentOrder.value?.price || 0;
        status.value = TaxiStatus.COMPLETED;
        setTimeout(() => {
            goOnline(); // Search for next order automatically
        }, 3000);
    };

    watch(rawGameCoords, (newCoords) => {
        if (!newCoords || !currentOrder.value) return;

        if (status.value === TaxiStatus.EN_ROUTE_PICKUP) {
            distanceToTarget.value = calculateDistance(newCoords, currentOrder.value.rawPointA);
        } else if (status.value === TaxiStatus.EN_ROUTE_DROPOFF) {
            distanceToTarget.value = calculateDistance(newCoords, currentOrder.value.rawPointB);
        }
    }, { deep: true });

    return {
        status,
        earnings,
        currentOrder,
        waitingTime,
        distanceToTarget,
        currentTripDistance,
        currentTripCost,
        truckSpeed,
        goOnline,
        goOffline,
        acceptOrder,
        rejectOrder,
        arriveAtPickup,
        startTrip,
        completeTrip
    };
}
