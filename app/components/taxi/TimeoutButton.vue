<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
    text: string;
    duration: number; // in milliseconds
    onAction: () => void;
    onTimeout: () => void;
}>();

const progress = ref(100);
let startTime = 0;
let animationFrameId = 0;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const startTimer = () => {
    startTime = performance.now();
    
    const animate = (time: number) => {
        const elapsed = time - startTime;
        let remaining = Math.max(0, props.duration - elapsed);
        progress.value = (remaining / props.duration) * 100;
        
        if (remaining > 0) {
            animationFrameId = requestAnimationFrame(animate);
        }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    timeoutId = setTimeout(() => {
        props.onTimeout();
    }, props.duration);
};

onMounted(() => {
    startTimer();
});

onUnmounted(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (timeoutId) clearTimeout(timeoutId);
});
</script>

<template>
    <button class="timeout-button" @click="onAction">
        <!-- Base Dark Layer -->
        <div class="timeout-base">
            <span class="text">{{ text }}</span>
            <div class="timer-circle" v-if="progress > 0">
                {{ Math.ceil(progress / 100 * (duration / 1000)) }}
            </div>
        </div>

        <!-- Clipped Yellow Fill Layer -->
        <div class="timeout-fill" :style="{ '--progress': progress + '%' }">
            <div class="timeout-fill-content">
                <span class="text">{{ text }}</span>
                <div class="timer-circle" v-if="progress > 0">
                    {{ Math.ceil(progress / 100 * (duration / 1000)) }}
                </div>
            </div>
        </div>
    </button>
</template>

<style scoped lang="scss">
.timeout-button {
    position: relative;
    width: 100%;
    height: 56px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 28px;
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    
    &:active {
        transform: scale(0.96);
    }

    @media (max-width: 768px) {
        height: 48px;
        border-radius: 24px;
    }
}

.timeout-base, .timeout-fill-content {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
}

.timeout-fill {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #ffcc00;
    border-radius: 28px;
    clip-path: inset(0 calc(100% - var(--progress, 100%)) 0 0);
    pointer-events: none;

    @media (max-width: 768px) { border-radius: 24px; }
}

.timeout-base {
    .text { color: rgba(255, 255, 255, 0.8); }
    .timer-circle { color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.1); }
}

.timeout-fill-content {
    .text { color: #111; }
    .timer-circle { color: #111; background: rgba(0, 0, 0, 0.15); }
}

.text {
    font-size: 1.15rem;
    font-weight: 700;
    font-family: 'Inter', 'Roboto', sans-serif;
    letter-spacing: 0.5px;
    
    @media (max-width: 768px) {
        font-size: 1.05rem;
    }
}

.timer-circle {
    position: absolute;
    right: 8px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.1rem;
    
    @media (max-width: 768px) {
        width: 32px;
        height: 32px;
        right: 8px;
        font-size: 0.95rem;
    }
}
</style>
