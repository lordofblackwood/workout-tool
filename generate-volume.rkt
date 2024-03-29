#lang racket/base
(require "workout-types.rkt")

(provide generate-volume)

(define (generate-volume resistance-tool)
  (let ([max-level (resistance-max-level resistance-tool)]
        [max-reps 12]
        [min-reps 1])
    (build-vector
     (add1 max-reps)
     (λ (y)
       (build-vector
        (add1 max-level)
        (λ (x) 1))))))

;(require "cable.rkt")
;(vector-ref (vector-ref (generate-volume CABLE) 0) 15)