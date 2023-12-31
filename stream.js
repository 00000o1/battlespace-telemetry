import Sensor from './sensor.js';

export default class SensorArray {
  #sensors = [];
  #isStreaming = false;
  #accumulate = false;
  #state = {};
  #delay = 0;
  #animationFrameDelay = false
  #timestamp = true;

  static from(sensorArray) {
    const instance = new this;
    for(const sensor of sensorArray) {
      if ( sensor instanceof Sensor ) {
        instance.add(sensor);
      } else {
        console.warn(`Object ${sensor} not instance of Sensor`, sensor);
      }
    }
  }

  constructor(opts = {}) {
    if ( opts ) {
      for( const [key, value] of Object.entries(opts) ) {
        switch (key) {
          case 'delay': {
            this.delay = value;
          }; break;
          case 'accumulate': {
            this.#accumulate = !!value;
          }; break;
          case 'timestamp': {
            this.#timestamp = !!value;
          }; break;
          default: {
            throw new TypeError(`Unknown option: ${key} = ${value}`);
          }; break;
        }
      }
    }
  }

  get delay() {
    return this.#delay;
  }

  set delay(value) {
    if ( typeof value == 'string' ) {
      if ( value == 'requestAnimationFrame' ) {
        this.#delay = value;
        this.#animationFrameDelay = true;
        return;
      }
    }
    value = Number.parseInt(value);
    if ( Number.isInteger(value) ) {
      this.#delay = value;
    } else {
      throw new TypeError(`Invalid delay value. Received: ${value}. Must be a valid positive integer milisecond delay or the string 'requestAnimationFrame'`);
    }
  }

  add(sensor) {
    if (sensor instanceof Sensor && !this.#sensors.includes(sensor)) {
      sensor.timestamp = this.#timestamp;
      this.#sensors.push(sensor);
    }
  }

  remove(sensor) {
    this.#sensors = this.#sensors.filter(s => s !== sensor);
  }

  start() {
    this.#isStreaming = true;
  }

  stop() {
    this.#isStreaming = false;
  }

  async *#generateStream() {
    this.#isStreaming = true;
    while (this.#isStreaming) {
      let state = {};

      // Only include sensors that have data available
      for (const sensor of this.#sensors.filter(s => s.hasData())) {
        const data = await sensor.popData();
        const extract = sensor.extractState(data);
        if ( this.#timestamp ) {
          extract[Object.getOwnPropertyNames(extract)[0]].$timestamp = data.$timestamp;
        }
        state = { ...state, ...extract  };
      }

      if (Object.keys(state).length !== 0) {
        if ( this.#timestamp ) {
          state.$timestamp = Date.now(); // should this be high res?
        }
        if ( this.#accumulate ) {
          Object.assign(this.#state, state);
          yield this.#state;
        } else { 
          yield state;
        }
      }

      // Delay before the next iteration to manage the loop frequency
      if ( this.#animationFrameDelay ) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      } else if ( this.delay >= 0 ) {
        await new Promise(resolve => setTimeout(resolve, this.#delay));
      }
    }
  }

  get stream() {
    return this.#generateStream();
  }

  // This is the method that makes the class compatible with the async iteration protocol
  async *[Symbol.asyncIterator]() {
    yield *this.stream;
  }
}

