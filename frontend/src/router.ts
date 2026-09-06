import { createRouter, createWebHistory } from 'vue-router';
import QueueView from './views/QueueView.vue';
import AnnotateView from './views/AnnotateView.vue';
import IngestView from './views/IngestView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'queue', component: QueueView },
    { path: '/ingest', name: 'ingest', component: IngestView },
    { path: '/items/:id', name: 'annotate', component: AnnotateView, props: true },
  ],
});
