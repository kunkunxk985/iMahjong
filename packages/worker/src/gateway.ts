/** Branded public entrypoint; forward HTTP and WebSocket upgrades unchanged. */
export default {
  fetch(request: Request, env: { GAME_SERVICE: Fetcher }): Promise<Response> {
    return env.GAME_SERVICE.fetch(request);
  },
};
