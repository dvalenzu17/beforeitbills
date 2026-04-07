// components/Card.js
import React from "react";
import CardBase from "./ui/CardBase";

export default function Card({ children, style, variant = "default" }) {
  return (
    <CardBase variant={variant} style={style}>
      {children}
    </CardBase>
  );
}
