import React, { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary][${this.props.room || 'unknown'}]`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '32px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px',
          display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center'
        }}>
          <AlertTriangle size={32} color="#ef4444" />
          <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: '1rem' }}>
            Error in room: {this.props.room || 'Unknown'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => this.setState({ error: null })}
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
