import React from 'react';
export const Card = ({ children, className }: any) => <div className={className}>{children}</div>;
export const CardContent = ({ children, className }: any) => <div className={className}>{children}</div>;
export const CardDescription = ({ children }: any) => <p>{children}</p>;
export const CardHeader = ({ children, className }: any) => <div className={className}>{children}</div>;
export const CardTitle = ({ children }: any) => <h3>{children}</h3>;
