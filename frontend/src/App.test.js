import { render, screen } from '@testing-library/react';
import Landing from './components/Landing';

test('renders landing component without routing', () => {
  render(<Landing />);
  const titleElement = screen.getByText(/The Gang - Poker/i);
  expect(titleElement).toBeInTheDocument();
});
