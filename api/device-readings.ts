import { handleDeviceRequest } from '../server/device-handler'

export default {
  fetch(request: Request) {
    return handleDeviceRequest(request, process.env)
  },
}
