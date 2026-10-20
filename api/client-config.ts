import { handleClientConfig } from '../server/client-config'

export default {
  fetch(request: Request) { return handleClientConfig(request, process.env) },
}
