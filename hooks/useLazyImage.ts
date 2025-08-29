"use client";

import { useState, useEffect, useRef } from "react";

interface UseLazyImageOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useLazyImage(
  imageUrl?: string,
  options: UseLazyImageOptions = {}
) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const { threshold = 0.1, rootMargin = "50px" } = options;

  useEffect(() => {
    if (!imageUrl || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [imageUrl, threshold, rootMargin]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoaded(false);
    setHasError(true);
  };

  return {
    imgRef,
    shouldLoad: isInView,
    isLoaded,
    hasError,
    handleImageLoad,
    handleImageError,
  };
}
