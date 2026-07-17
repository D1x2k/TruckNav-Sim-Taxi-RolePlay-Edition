<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
    text: string;
    successText?: string;
    disabled?: boolean;
    onAction: () => void | Promise<void>;
}>();

const containerRef = ref<HTMLElement | null>(null);
const thumbRef = ref<HTMLElement | null>(null);

const isDragging = ref(false);
const progress = ref(0); // 0 to 1
const isCompleted = ref(false);

const cWidth = ref(0);
const tWidth = ref(0);

let startX = 0;

const updateWidths = () => {
    if (containerRef.value && thumbRef.value) {
        cWidth.value = containerRef.value.offsetWidth;
        tWidth.value = thumbRef.value.offsetWidth;
    }
};

const startDrag = (e: MouseEvent | TouchEvent) => {
    if (isCompleted.value || props.disabled) return;
    
    updateWidths();
    isDragging.value = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX = clientX - (progress.value * (cWidth.value - tWidth.value));
};

const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value || isCompleted.value) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    let newX = clientX - startX;
    
    const maxScroll = cWidth.value - tWidth.value;
    
    if (newX < 0) newX = 0;
    if (newX > maxScroll) newX = maxScroll;
    
    progress.value = newX / maxScroll;
    
    if (progress.value >= 0.98) {
        completeDrag();
    }
};

const stopDrag = () => {
    if (!isDragging.value || isCompleted.value) return;
    isDragging.value = false;
    
    // Snap back
    if (progress.value < 0.98) {
        progress.value = 0;
    }
};

const completeDrag = async () => {
    isDragging.value = false;
    isCompleted.value = true;
    progress.value = 1;
    
    try {
        await props.onAction();
    } finally {
        setTimeout(() => {
            isCompleted.value = false;
            progress.value = 0;
        }, 1000);
    }
};

onMounted(() => {
    updateWidths();
    window.addEventListener('resize', updateWidths);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateWidths);
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('touchend', stopDrag);
});

const thumbStyle = computed(() => {
    if (cWidth.value === 0) return { transform: `translateX(0px)` };
    const maxScroll = cWidth.value - tWidth.value;
    const px = progress.value * maxScroll;
    return {
        transform: `translateX(${px}px)`,
        transition: isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
    };
});

const fillStyle = computed(() => {
    if (cWidth.value === 0) return { width: `0px` };
    const maxScroll = cWidth.value - tWidth.value;
    const px = progress.value * maxScroll + tWidth.value;
    return {
        width: `${px}px`,
        transition: isDragging.value ? 'none' : 'width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
    };
});
</script>

<template>
    <div 
        ref="containerRef" 
        class="swipe-button-container"
        :class="{ 'is-completed': isCompleted, 'is-disabled': disabled }"
    >
        <div class="swipe-background"></div>
        <div class="swipe-fill" :style="fillStyle"></div>
        
        <div class="swipe-text" :class="{ 'faded': progress > 0.3 }">
            {{ isCompleted ? (successText || text) : text }}
        </div>
        
        <div 
            ref="thumbRef" 
            class="swipe-thumb" 
            :style="thumbStyle"
            @mousedown="startDrag"
            @touchstart="startDrag"
        >
            <Icon v-if="!isCompleted" name="lucide:chevron-right" class="thumb-icon" />
            <Icon v-else name="lucide:check" class="thumb-icon success" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.swipe-button-container {
    position: relative;
    width: 100%;
    height: 56px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 28px;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    display: flex;
    align-items: center;
    box-shadow: inset 0 4px 12px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05);
    border: 1px solid rgba(255, 255, 255, 0.03);
    
    &.is-completed {
        .swipe-background {
            background: rgba(255, 204, 0, 0.15);
        }
    }

    &.is-disabled {
        opacity: 0.5;
        .swipe-thumb {
            cursor: not-allowed;
            background: rgba(255, 255, 255, 0.2);
            box-shadow: none;
            color: rgba(255, 255, 255, 0.4);
            .thumb-icon { color: rgba(255, 255, 255, 0.5); }
        }
        .swipe-text {
            color: rgba(255, 255, 255, 0.5);
        }
    }

    @media (max-width: 768px) {
        height: 48px;
    }
}

.swipe-background {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    transition: background 0.3s ease;
}

.swipe-fill {
    position: absolute;
    top: 4px; left: 4px; bottom: 4px;
    background: linear-gradient(90deg, rgba(255, 204, 0, 0.1), rgba(255, 204, 0, 0.6));
    border-radius: 24px;
    width: 0;
    
    @media (max-width: 768px) {
        border-radius: 20px;
    }
}

.swipe-text {
    position: absolute;
    width: 100%;
    text-align: center;
    font-weight: 700;
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.9);
    pointer-events: none;
    z-index: 2;
    transition: opacity 0.3s ease;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    
    &.faded {
        opacity: 0;
    }

    @media (max-width: 768px) {
        font-size: 1rem;
    }
}

.swipe-thumb {
    position: absolute;
    left: 4px;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #ffe066, #ffcc00);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    box-shadow: 0 4px 15px rgba(255, 204, 0, 0.5), inset 0 2px 2px rgba(255, 255, 255, 0.4);
    z-index: 3;
    transition: transform 0.1s;
    
    &:active {
        cursor: grabbing;
        transform: scale(0.95);
    }

    @media (max-width: 768px) {
        width: 40px;
        height: 40px;
    }
}

.thumb-icon {
    width: 24px;
    height: 24px;
    color: #332200;
    
    &.success {
        color: #4caf50;
    }

    @media (max-width: 768px) {
        width: 20px;
        height: 20px;
    }
}
</style>
