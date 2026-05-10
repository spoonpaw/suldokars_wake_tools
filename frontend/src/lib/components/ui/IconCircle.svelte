<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let { color, size = 'md', children }: Props = $props();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const colorClasses = $derived(color ?? 'bg-neutral-700 text-neutral-300');
</script>

<div class="flex items-center justify-center rounded-full {sizeClasses[size]} {colorClasses}">
  <span class={iconSizeClasses[size]}>
    {@render children()}
  </span>
</div>
