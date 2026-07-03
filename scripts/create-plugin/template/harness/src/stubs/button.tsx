import React from 'react';
export const Button = ({ children, onClick, disabled, className }: any) =>
  <button onClick={onClick} disabled={disabled} className={className}>{children}</button>;
