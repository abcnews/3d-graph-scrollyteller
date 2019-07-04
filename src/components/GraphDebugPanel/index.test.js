import React from 'react';
import renderer from 'react-test-renderer';

import GraphDebugPanel from '.';

describe('GraphDebugPanel', () => {
  test('It renders', () => {
    const component = renderer.create(<GraphDebugPanel />);

    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
