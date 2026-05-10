<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
    children: Snippet;
  }

  let { variant = 'default', size = 'md', children }: Props = $props();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs'
  };

  const colorClasses = $derived.by(() => {
    if (variant === 'success') return 'bg-green-900/40 text-green-300';
    if (variant === 'warning') return 'bg-amber-900/40 text-amber-300';
    if (variant === 'danger') return 'bg-red-900/40 text-red-300';
    if (variant === 'info') return 'bg-cyan-900/40 text-cyan-300';
    return 'bg-neutral-700 text-neutral-300';
  });
</script>

<span class="inline-flex items-center font-medium rounded-full {sizeClasses[size]} {colorClasses}">
  {@render children()}
</span>
