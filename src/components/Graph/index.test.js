import React from 'react';
import renderer from 'react-test-renderer';

import Graph from '.';

describe('Graph', () => {
  test('It renders', () => {
    const component = renderer.create(<Graph />);

    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();
  });
});
