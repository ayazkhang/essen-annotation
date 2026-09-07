<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { api } from './api';
import './app.css';
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
