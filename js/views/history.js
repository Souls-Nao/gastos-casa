import tickets from './history/tickets.js';

export default function history(root, { query }) {
  return tickets(root, query);
}
