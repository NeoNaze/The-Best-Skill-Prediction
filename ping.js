const PING_INTERVAL = 6000,
	PING_TIMEOUT = 30000,
	PING_HISTORY_MAX = 20

class Ping {
	constructor(dispatch) {
		this._timeout = null
		this._waiting = false
		this._lastSent = this.min = this.max = this.avg = 0
		this.history = []

		let ping = () => {
			dispatch.toServer('C_REQUEST_GAMESTAT_PING', 1)
			this._waiting = true
			this._lastSent = Date.now()
			this._timeout = setTimeout(ping, PING_TIMEOUT)
		}

		dispatch.hook('S_SPAWN_ME', 1, () => { ping() })
		dispatch.hook('S_LOAD_TOPO', 1, event => { clearTimeout(this._timeout) })
		dispatch.hook('S_RETURN_TO_LOBBY', 1, () => { clearTimeout(this._timeout) })

		// Disable inaccurate ingame ping so we have exclusive use of ping packets
		dispatch.hook('C_REQUEST_GAMESTAT_PING', 1, () => {
			dispatch.toClient('S_RESPONSE_GAMESTAT_PONG', 1)
			return false
		})

		dispatch.hook('S_RESPONSE_GAMESTAT_PONG', 1, () => {
			let result = Date.now() - this._lastSent

			clearTimeout(this._timeout)

			if(!this._waiting) this.history.pop() // Oops! We need to recalculate the last value

			this.history.push(result)

			if(this.history.length > PING_HISTORY_MAX) this.history.shift()

			// Recalculate statistics variables
			this.min = this.max = this.history[0]
			this.avg = 0

			for(let p of this.history) {
				if(p < this.min) this.min = p
				else if(p > this.max) this.max = p

				this.avg += p
			}

			this.avg /= this.history.length

			this._waiting = false
			this._timeout = setTimeout(ping, PING_INTERVAL - result)
			return false
		})
	}
}

let map = new WeakMap()

module.exports = function Require(dispatch) {
	if(map.has(dispatch.base)) return map.get(dispatch.base)

	let ping = new Ping(dispatch)
	map.set(dispatch.base, ping)
	return ping
}