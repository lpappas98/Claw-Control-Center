/**
 * Test Parallelism Task 2 - Frontend Feature
 * Created for testing concurrent execution model
 */

import React, { useState, useEffect } from 'react';

/**
 * ParallelismTestFeature Component
 * 
 * This is a dummy frontend feature created to test the concurrent execution model
 * in the dev-2 (Patch) lane. It demonstrates a basic React component that could
 * be used as a foundation for more complex features.
 */
export const ParallelismTestFeature: React.FC = () => {
  const [status, setStatus] = useState<string>('idle');
  const [executionTime, setExecutionTime] = useState<number>(0);

  useEffect(() => {
    const startTime = Date.now();
    setStatus('processing');

    // Simulate some async work
    const timer = setTimeout(() => {
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);
      setStatus('completed');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="parallelism-test-feature">
      <h2>Test Parallelism Feature</h2>
      <div className="status">
        <p>Status: <strong>{status}</strong></p>
        <p>Execution Time: <strong>{executionTime}ms</strong></p>
      </div>
      <div className="description">
        <p>This component demonstrates a basic frontend feature created as part of testing the concurrent execution model.</p>
      </div>
    </div>
  );
};

export default ParallelismTestFeature;
