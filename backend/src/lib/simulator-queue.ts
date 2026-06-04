export interface SimulatorMessage {
  id: string;
  phone: string;
  role: 'USER' | 'PROFESSIONAL';
  type: 'text' | 'template' | 'template_buttons' | 'template_url' | 'image' | 'audio';
  content: string;
  timestamp: Date;
}

class SimulatorQueue {
  private messages: SimulatorMessage[] = [];
  private readonly maxSize = 100;

  enqueue(message: Omit<SimulatorMessage, 'id' | 'timestamp'>): void {
    this.messages.push({
      ...message,
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
    });
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }

  dequeue(phone: string, role: 'USER' | 'PROFESSIONAL'): SimulatorMessage[] {
    const pending = this.messages.filter((m) => m.phone === phone && m.role === role);
    this.messages = this.messages.filter((m) => !(m.phone === phone && m.role === role));
    return pending;
  }
}

export const simulatorQueue = new SimulatorQueue();
