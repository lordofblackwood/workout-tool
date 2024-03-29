#lang racket/base

(require "workout-types.rkt")
(provide LAT-MACHINE)
(define lat-machine-max-level 12)

;(: get-lat-machine-weight (-> Natural Natural))
(define (get-lat-machine-level weight)
  (weight-level-map weight))

;(: get-lat-machine-weight (-> Natural Natural))
(define (get-lat-machine-weight level)
  (cond
    [(> level lat-machine-max-level) (level-weight-map lat-machine-max-level)]
    [(< level 1) (level-weight-map 0 )]
    [#t (level-weight-map level)]))

(define LAT-MACHINE
  (resistance get-lat-machine-level
              get-lat-machine-weight
              lat-machine-max-level))

;(: level-weight-map (-> Natural Natural))
(define (level-weight-map level)
  (hash-ref 
   (hash 0 20
         1 35
         2 50
         3 65
         4 80
         5 95
         6 110
         7 125
         8 145
         9 165
         10 185
         11 205
         12 225)
   level))

;(: weight-level-map (-> Natural Natural))
(define (weight-level-map weight)
  (hash-ref 
   (hash 20 0
         35 1
         50 2
         65 3
         80 4
         95 5
         110 6
         125 7
         145 8
         165 9
         185 10
         205 11
         225 12)
   weight))