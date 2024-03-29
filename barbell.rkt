#lang racket/base
(require "workout-types.rkt")
(provide BARBELL)

(define barbell-max-level 70)

;; Cables just jump in increments of 10lbs.
;(: get-cable-level (-> Natural Natural))
(define (get-barbell-level weight)
    (/ (- weight 45) 10))

;(: get-cable-weight (-> Natural Natural))
(define (get-barbell-weight level)
  (cond
    [(> level barbell-max-level) (get-barbell-weight barbell-max-level)]
    [(< level 1) 45]
    [#t (+ 45 (* 10 level))]))

(define BARBELL
  (resistance get-barbell-level
              get-barbell-weight
              barbell-max-level))