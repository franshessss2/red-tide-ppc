import { handleClientConfig } from '../server/client-config.js'

export default {
  fetch(request: Request) { return handleClientConfig(request, process.env) },
}
