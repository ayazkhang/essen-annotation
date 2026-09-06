<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { api } from './api';
</script>

<template>
  <div class="shell">
    <header class="top">
      <div class="brand">
        <RouterLink to="/" class="logo">Essen Annotation</RouterLink>
        <span class="sub">Clinical STT gold standard</span>
      </div>
      <nav>
        <RouterLink to="/">Queue</RouterLink>
        <RouterLink to="/ingest">Ingest</RouterLink>
        <a :href="api.exportUrl()" download="gold-standard.jsonl">Export JSONL</a>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem 3rem;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.logo {
  font-weight: 600;
  font-size: 1.25rem;
  color: var(--ink);
  text-decoration: none;
}

.sub {
  font-size: 0.85rem;
  color: var(--muted);
}

nav {
  display: flex;
  gap: 1rem;
  align-items: center;
}

nav a {
  font-weight: 500;
}

nav a.router-link-active {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 4px;
}
</style>
