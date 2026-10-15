import { Component, type ReactNode } from 'react';

export class MapBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch(error: Error) { console.error('BOS/42 renderer:', error.message); }
  render() {
    if (this.state.failed) return <div className="map-loading renderer-recovery" role="alert"><strong>The 3D view needs to restart</strong><span>Restart the map to continue exploring.</span><button className="secondary-button" onClick={() => this.setState({failed: false})}>Restart 3D view</button></div>;
    return this.props.children;
  }
}
