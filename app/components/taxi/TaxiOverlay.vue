<script lang="ts" setup>
import { computed } from 'vue';
import { useTaxiSystem, TaxiStatus } from '~/composables/useTaxiSystem';
import { useSettings } from '~/composables/Settings';
import SwipeButton from './SwipeButton.vue';
import TimeoutButton from './TimeoutButton.vue';

const {
    status,
    earnings,
    currentOrder,
    waitingTime,
    distanceToTarget,
    currentTripCost,
    truckSpeed,
    goOnline,
    goOffline,
    acceptOrder,
    rejectOrder,
    arriveAtPickup,
    startTrip,
    completeTrip
} = useTaxiSystem();

const { activeSettings } = useSettings();

const formattedTime = computed(() => {
    const mins = Math.floor(waitingTime.value / 60);
    const secs = waitingTime.value % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

const isAtTarget = computed(() => {
    return distanceToTarget.value !== null && distanceToTarget.value < 1000 && truckSpeed.value === 0;
});
</script>

<template>
    <div class="taxi-overlay" :style="{ '--theme-color': activeSettings.themeColor }">
        <div class="taxi-header">
            <div class="earnings">
                <span>Баланс:</span>
                <strong class="neon-text">${{ earnings.toFixed(0) }}</strong>
            </div>
            <button 
                v-if="status !== TaxiStatus.OFFLINE" 
                class="btn-offline"
                @click="goOffline"
                title="Уйти с линии"
            >
                <Icon name="lucide:power" class="icon" />
            </button>
        </div>

        <div class="taxi-content">
            <Transition name="fade-slide" mode="out-in">
                
                <div v-if="status === TaxiStatus.OFFLINE" class="state-container" key="offline">
                    <SwipeButton 
                        text="Выйти на линию" 
                        successText="На линии"
                        :onAction="goOnline" 
                    />
                </div>

                <div v-else-if="status === TaxiStatus.SEARCHING" class="state-container searching" key="searching">
                    <div class="radar-container">
                        <div class="radar-ring"></div>
                        <div class="radar-ring delay"></div>
                        <Icon name="lucide:radar" class="radar-icon" />
                    </div>
                    <p class="status-text">Поиск заказов...</p>
                </div>

                <div v-else-if="status === TaxiStatus.OFFERING" class="state-container offering-sheet" key="offering">
                    <div class="offering-top">
                        <div class="pickup-eta">Новый заказ</div>
                        <button class="btn-close" @click="rejectOrder" title="Пропустить">
                            <Icon name="lucide:x" class="icon" />
                        </button>
                    </div>

                    <div class="offering-details-row">
                        <div class="offering-price">
                            ${{ currentOrder?.price }}
                        </div>
                        <div class="oba-badge">
                            <Icon name="lucide:map" class="oba-icon" />
                            <span>{{ (currentOrder?.distanceTotal! / 1000).toFixed(1) }} км</span>
                        </div>
                    </div>
                    
                    <TimeoutButton 
                        class="mt-1"
                        text="Принять заказ"
                        :duration="10000"
                        :onAction="acceptOrder"
                        :onTimeout="rejectOrder"
                    />
                </div>

                <div v-else-if="status === TaxiStatus.EN_ROUTE_PICKUP" class="state-container en-route" key="pickup">
                    <div class="distance-badge">
                        <Icon name="lucide:navigation" class="nav-icon" />
                        <span>До клиента: <strong>{{ Math.round(distanceToTarget || 0) }} м</strong></span>
                    </div>
                    <SwipeButton 
                        text="На месте" 
                        successText="Ждем клиента"
                        :disabled="!isAtTarget"
                        :onAction="arriveAtPickup" 
                    />
                </div>

                <div v-else-if="status === TaxiStatus.WAITING_PASSENGER" class="state-container waiting" key="waiting">
                    <div class="timer-badge">
                        <Icon name="lucide:clock" class="clock-icon" />
                        <span>Ожидание: <strong>{{ formattedTime }}</strong></span>
                    </div>
                    <SwipeButton 
                        text="В путь" 
                        successText="Поехали!"
                        :onAction="startTrip" 
                    />
                </div>

                <div v-else-if="status === TaxiStatus.EN_ROUTE_DROPOFF" class="state-container dropoff" key="dropoff">
                    <div class="card-details compact" style="width: 100%; margin-bottom: 8px;">
                        <div class="detail-item">
                            <Icon name="lucide:flag" class="detail-icon" />
                            <span>{{ Math.round(distanceToTarget || 0) }} м</span>
                        </div>
                        <div class="detail-item price" style="align-items: flex-end;">
                            <Icon name="lucide:wallet" class="detail-icon" />
                            <span>${{ currentOrder?.price }}</span>
                        </div>
                    </div>
                    <SwipeButton 
                        class="mt-2"
                        text="Завершить поездку" 
                        successText="Успешно!"
                        :disabled="!isAtTarget"
                        :onAction="completeTrip" 
                    />
                </div>

                <div v-else-if="status === TaxiStatus.COMPLETED" class="state-container completed" key="completed">
                    <div class="success-circle">
                        <Icon name="lucide:check" class="success-icon" />
                    </div>
                    <p class="status-text">Заказ завершен!</p>
                </div>

            </Transition>
        </div>
    </div>
</template>

<style scoped lang="scss">
.taxi-overlay {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: 360px;
    background: rgba(15, 15, 18, 0.75);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 20px;
    color: white;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    z-index: 100;
    pointer-events: auto;
    font-family: 'Inter', 'Roboto', sans-serif;
    
    @media (max-width: 768px) {
        width: calc(100% - 32px);
        bottom: 16px;
        padding: 14px;
        border-radius: 20px;
    }
}

.taxi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 12px;

    .earnings {
        font-size: 1.15rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        gap: 8px;

        .neon-text {
            color: #4caf50;
            font-size: 1.3rem;
            font-weight: 700;
            text-shadow: 0 0 10px rgba(76, 175, 80, 0.4);
        }
    }

    @media (max-width: 768px) {
        margin-bottom: 12px;
        padding-bottom: 8px;
        .earnings { font-size: 1rem; .neon-text { font-size: 1.15rem; } }
    }
}

.taxi-content {
    min-height: 80px;
    position: relative;
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-slide-enter-from {
    opacity: 0;
    transform: translateY(10px);
}
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

/* Buttons */
button {
    border: none;
    outline: none;
    cursor: pointer;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    font-family: inherit;
    
    &:active {
        transform: scale(0.96);
    }
}

.btn-primary, .btn-accept {
    background: #ffcc00;
    color: #111;
    padding: 14px 24px;
    width: 100%;
    font-size: 1.1rem;
    box-shadow: 0 4px 15px rgba(255, 204, 0, 0.3);

    &:hover {
        background: #ffd633;
        box-shadow: 0 6px 20px rgba(255, 204, 0, 0.5);
    }

    &.disabled, &:disabled {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.3);
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
    }

    @media (max-width: 768px) {
        padding: 12px 20px;
        font-size: 1rem;
    }
}

.btn-reject {
    background: rgba(255, 255, 255, 0.08);
    color: white;
    padding: 14px 16px;
    
    &:hover {
        background: rgba(255, 255, 255, 0.15);
    }

    @media (max-width: 768px) {
        padding: 12px 16px;
        font-size: 1rem;
    }
}

.btn-offline {
    background: rgba(255, 68, 68, 0.1);
    color: #ff4444;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    
    &:hover {
        background: rgba(255, 68, 68, 0.2);
        box-shadow: 0 0 12px rgba(255, 68, 68, 0.4);
    }

    .icon {
        width: 20px;
        height: 20px;
    }
}

/* Status Text */
.status-text {
    margin-top: 16px;
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);

    @media (max-width: 768px) {
        margin-top: 10px;
        font-size: 1rem;
    }
}

/* Radar Animation */
.radar-container {
    position: relative;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 10px;

    @media (max-width: 768px) {
        width: 48px;
        height: 48px;
        margin-top: 4px;
    }
}

.radar-icon {
    width: 32px;
    height: 32px;
    color: #ffcc00;
    z-index: 2;
}

.radar-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid #ffcc00;
    opacity: 0;
    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;

    &.delay {
        animation-delay: 1s;
    }
}

@keyframes pulse-ring {
    0% { transform: scale(0.5); opacity: 0.8; }
    100% { transform: scale(1.5); opacity: 0; }
}

/* Offering Sheet (Yandex Pro style) */
.offering-sheet {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 20px;
    padding: 16px;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.02);

    .offering-top {
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        width: 100%;
        margin-bottom: 16px;

        .pickup-eta {
            color: rgba(255, 255, 255, 0.9);
            font-size: 1.1rem;
            font-weight: 600;
        }

        .btn-close {
            position: absolute;
            right: 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.7);
            
            &:hover {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }

            .icon { width: 18px; height: 18px; }
        }
    }

    .offering-details-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        .offering-price {
            font-size: 2.5rem;
            font-weight: 800;
            color: #4caf50;
            text-shadow: 0 0 20px rgba(76, 175, 80, 0.4);
            line-height: 1;
        }

        .oba-badge {
            background: rgba(255, 255, 255, 0.1);
            padding: 8px 14px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            
            .oba-icon {
                color: #ffcc00;
                width: 18px;
                height: 18px;
            }

            span {
                font-weight: 600;
                font-size: 1.1rem;
                color: white;
            }
        }
    }

    @media (max-width: 768px) {
        padding: 14px;
        .offering-top { margin-bottom: 12px; .pickup-eta { font-size: 1rem; } }
        .offering-details-row {
            margin-bottom: 12px;
            .offering-price { font-size: 2.2rem; }
            .oba-badge { padding: 6px 12px; span { font-size: 1rem; } }
        }
    }
}

/* Badges (Distance / Time) */
.distance-badge, .timer-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.08);
    padding: 10px 16px;
    border-radius: 12px;
    margin-bottom: 16px;
    width: 100%;

    .nav-icon, .clock-icon {
        color: #ffcc00;
        width: 20px;
        height: 20px;
    }

    span {
        font-size: 1.05rem;
        color: rgba(255, 255, 255, 0.8);

        strong {
            color: white;
            font-weight: 700;
            margin-left: 4px;
        }
    }

    @media (max-width: 768px) {
        padding: 8px 12px;
        margin-bottom: 12px;
        span { font-size: 0.95rem; }
    }
}

/* Completed */
.success-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(76, 175, 80, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    border: 2px solid #4caf50;
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.3);

    .success-icon {
        width: 32px;
        height: 32px;
        color: #4caf50;
    }
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
</style>
