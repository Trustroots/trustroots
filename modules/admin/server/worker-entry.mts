export default {
  agendaStorage: () => import('./services/agenda-storage.server.service.mts'),
  agendaInventory: () =>
    import('./services/agenda-inventory.server.service.mts'),
};
