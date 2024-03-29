#lang racket/base
(require racket/match
         "barbell.rkt"
         "lat-machine.rkt"
         "cable.rkt"
         "dumbbell.rkt")
(provide BARBELL
         CABLE
         DUMBBELL
         LAT-MACHINE
         get-resistance)


(define (get-resistance mode)
  (match mode
    ["Cable" CABLE]
    ["Dumbbell" DUMBBELL]
    ["Lat Machine" LAT-MACHINE]
    ["Barbell" BARBELL]))