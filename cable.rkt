#lang racket/base
(require "workout-types.rkt")
(provide CABLE)

(define cable-max-level 15)

;; Cables just jump in increments of 10lbs.
;(: get-cable-level (-> Natural Natural))
(define (get-cable-level weight)
    (/ weight 10))

;(: get-cable-weight (-> Natural Natural))
(define (get-cable-weight level)
  (cond
    [(> level cable-max-level) (get-cable-weight cable-max-level)]
    [(< level 1) 0]
    [#t (* 10 level)]))

(define CABLE
  (resistance get-cable-level
              get-cable-weight
              cable-max-level))